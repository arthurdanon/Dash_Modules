const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

// Helpers
const hasRole = (me, role) => String(me?.role || '').toUpperCase() === role;
const isAdmin = (me) => !!me?.isAdmin || hasRole(me, 'ADMIN');
const isOwner = (me) => !!me?.isOwner || hasRole(me, 'OWNER');
const isAdminOrOwner = (me) => isAdmin(me) || isOwner(me);

async function isMemberOfSite(userId, siteId) {
  const m = await prisma.coreSiteMember.findFirst({
    where: { userId: String(userId), siteId: String(siteId) },
    select: { id: true },
  });
  return !!m;
}

/**
 * GET /api/sites
 * - Admin/Owner : tous les sites
 * - Sinon : sites dont je suis membre
 * + managersCount (MANAGER uniquement), usersCount (USER)
 */
r.get('/sites', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const where = isAdminOrOwner(me) ? {} : { members: { some: { userId: me.id } } };

    const sites = await prisma.coreSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      sites.map(async (s) => {
        const [managersCount, usersCount] = await Promise.all([
          prisma.coreSiteMember.count({
            where: {
              siteId: s.id,
              isManager: true,
              user: { role: { name: 'MANAGER' } }, // ne compte pas OWNER/ADMIN
            },
          }),
          prisma.coreSiteMember.count({
            where: {
              siteId: s.id,
              user: { role: { name: 'USER' } },
            },
          }),
        ]);
        return { ...s, managersCount, usersCount };
      })
    );

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/sites/:siteId
 * - Admin/Owner : OK
 * - Sinon : doit être membre du site
 */
r.get('/sites/:siteId', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const siteId = String(req.params.siteId);

    if (!isAdminOrOwner(me)) {
      const member = await isMemberOfSite(me.id, siteId);
      if (!member) return res.status(403).json({ error: 'Forbidden' });
    }

    const s = await prisma.coreSite.findUnique({ where: { id: siteId } });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/sites/:siteId/teams
 * - Admin/Owner : OK
 * - Sinon : membre du site
 */
r.get('/sites/:siteId/teams', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const siteId = String(req.params.siteId);

    if (!isAdminOrOwner(me)) {
      const member = await isMemberOfSite(me.id, siteId);
      if (!member) return res.status(403).json({ error: 'Forbidden' });
    }

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

module.exports = r;
