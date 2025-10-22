// backend/src/routes/AdminRoutes/AdminSites.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireManager, scopedToSite } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

// Tous les endpoints ici exigent un utilisateur connecté
// avec au moins le niveau MANAGER (MANAGER/OWNER/ADMIN)
r.use(requireAuth, requireManager);

/* Utils rôle */
const isAdmin   = (me) => !!me?.isAdmin;
const isOwner   = (me) => !!me?.isOwner;
const isManager = (me) => !!me?.isManager;

/* =========================================================
 * GET /api/admin/sites
 * - ADMIN **et** OWNER : voient TOUS les sites
 * - MANAGER            : uniquement les sites dont ils sont membres
 * ========================================================= */
r.get('/sites', async (req, res, next) => {
  try {
    const me = req.me;

    const where = (isAdmin(me) || isOwner(me))
      ? {}
      : { members: { some: { userId: me.id } } };

    const sites = await prisma.coreSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, modules: true, settingId: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Enrichi avec le nombre d'owners/managers/users
    const enriched = await Promise.all(
      sites.map(async (s) => {
        const [ownersCount, managersCount, usersCount] = await Promise.all([
          prisma.coreSiteMember.count({
            where: { siteId: s.id, user: { role: { name: 'OWNER' } } },
          }),
          prisma.coreSiteMember.count({
            where: { siteId: s.id, isManager: true, user: { role: { name: 'MANAGER' } } },
          }),
          prisma.coreSiteMember.count({
            where: { siteId: s.id, user: { role: { name: 'USER' } } },
          }),
        ]);
        return { ...s, ownersCount, managersCount, usersCount };
      })
    );

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

/* =========================================================
 * POST /api/admin/sites
 * - ADMIN ou OWNER autorisés (inchangé)
 * - Respecte le quota maxSites du CoreSetting
 * Body: { name, settingId? }
 * ========================================================= */
r.post('/sites', async (req, res, next) => {
  try {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) {
      return res.status(403).json({ error: 'Owner/Admin only' });
    }

    const { name, settingId } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    // Détermination du CoreSetting
    let setting = null;
    if (settingId) {
      setting = await prisma.coreSetting.findUnique({
        where: { id: String(settingId) },
        select: { id: true, maxSites: true },
      });
      if (!setting) return res.status(400).json({ error: 'Invalid settingId' });
    } else {
      if (isAdmin(me)) {
        setting = await prisma.coreSetting.findFirst({ select: { id: true, maxSites: true } });
      } else {
        // OWNER : on récupère le setting d’un site auquel il a accès, sinon le premier
        const anySite = await prisma.coreSite.findFirst({
          where: { members: { some: { userId: me.id } } },
          select: { setting: { select: { id: true, maxSites: true } } },
        });
        setting = anySite?.setting || await prisma.coreSetting.findFirst({ select: { id: true, maxSites: true } });
      }
      if (!setting) return res.status(400).json({ error: 'No setting found' });
    }

    // Quota maxSites
    if (setting.maxSites != null) {
      const count = await prisma.coreSite.count({ where: { settingId: setting.id } });
      if (count >= setting.maxSites) return res.status(403).json({ error: 'Site quota reached' });
    }

    const site = await prisma.coreSite.create({
      data: { name: name.trim(), settingId: setting.id, modules: {} },
    });

    // Ajoute (ou met à jour) le membership du créateur en manager du site
    await prisma.coreSiteMember.upsert({
      where: { siteId_userId: { siteId: site.id, userId: me.id } },
      update: { isManager: true },
      create: { siteId: site.id, userId: me.id, isManager: true },
    });

    res.status(201).json(site);
  } catch (e) {
    next(e);
  }
});

/* =========================================================
 * GET /api/admin/sites/:siteId/teams
 * POST /api/admin/sites/:siteId/teams
 * - ADMIN : OK partout
 * - OWNER/MANAGER : doivent être membres du site (scopedToSite)
 *   (comportement inchangé)
 * ========================================================= */
r.get('/sites/:siteId/teams', scopedToSite, async (req, res, next) => {
  try {
    const siteId = String(req.params.siteId);
    const teams = await prisma.coreTeam.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
      include: { manager: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(teams);
  } catch (e) {
    next(e);
  }
});

r.post('/sites/:siteId/teams', scopedToSite, async (req, res, next) => {
  try {
    const me = req.me;
    // Création d’équipe : ADMIN ou OWNER (on bloque MANAGER par design)
    if (!(isAdmin(me) || isOwner(me))) {
      return res.status(403).json({ error: 'Owner/Admin only' });
    }

    const siteId = String(req.params.siteId);
    const { name, managerId } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    const site = await prisma.coreSite.findUnique({ where: { id: siteId } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const data = { name: name.trim(), site: { connect: { id: siteId } } };
    if (managerId) data.manager = { connect: { id: String(managerId) } };

    try {
      const team = await prisma.coreTeam.create({
        data,
        include: { manager: { select: { id: true, firstName: true, lastName: true } } },
      });
      res.status(201).json(team);
    } catch (e) {
      if (e?.code === 'P2002') return res.status(409).json({ error: 'Team name already exists for this site' });
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

/* =========================================================
 * PATCH /api/admin/sites/:siteId/modules
 * - **ADMIN uniquement** (OWNER n’a PAS le droit d’activer/désactiver)
 * ========================================================= */
r.patch('/sites/:siteId/modules', async (req, res, next) => {
  try {
    const me = req.me;
    if (!isAdmin(me)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { siteId } = req.params;
    const { modules } = req.body || {};
    const site = await prisma.coreSite.update({
      where: { id: String(siteId) },
      data: { modules: modules || {} },
      select: { id: true, name: true, modules: true },
    });
    res.json(site);
  } catch (e) {
    next(e);
  }
});

/* =========================================================
 * DELETE /api/admin/sites/:siteId
 * - ADMIN ou OWNER autorisés (inchangé)
 * - Pour les non-admin (OWNER), scopedToSite reste exigé
 *   => un OWNER ne peut supprimer que les sites dont il est membre
 * ========================================================= */
r.delete('/sites/:siteId', scopedToSite, async (req, res, next) => {
  try {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) {
      return res.status(403).json({ error: 'Owner/Admin only' });
    }

    const siteId = String(req.params.siteId);

    // Détacher les références avant suppression du site
    const teams = await prisma.coreTeam.findMany({ where: { siteId }, select: { id: true } });
    const teamIds = teams.map(t => t.id);

    await prisma.$transaction([
      teamIds.length
        ? prisma.coreUser.updateMany({
            where: { teamId: { in: teamIds } },
            data: { teamId: null },
          })
        : prisma.$executeRaw`SELECT 1`,
      prisma.coreUser.updateMany({ where: { primarySiteId: siteId }, data: { primarySiteId: null } }),
      prisma.coreSiteMember.deleteMany({ where: { siteId } }),
      prisma.coreTeam.deleteMany({ where: { siteId } }),
      prisma.coreSite.delete({ where: { id: siteId } }),
    ]);

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

module.exports = r;
