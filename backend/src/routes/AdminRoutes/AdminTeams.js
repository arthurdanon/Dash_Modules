// backend/src/routes/AdminRoutes/AdminTeams.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, scopedToSite } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

/* Utils rôles */
function isAdmin(me) { return !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN'; }
function isOwner(me) { return !!me?.isOwner || String(me?.role).toUpperCase() === 'OWNER'; }
function ensureAdminOrOwner(me) {
  if (isAdmin(me) || isOwner(me)) return;
  const err = new Error('Forbidden'); err.status = 403; throw err;
}

/**
 * GET /api/admin/sites/:siteId/teams
 * - ADMIN & OWNER seulement (lecture côté admin)
 * - scopedToSite : ADMIN bypass / OWNER doit appartenir au site
 */
r.get('/sites/:siteId/teams', requireAuth, scopedToSite, async (req, res, next) => {
  try {
    ensureAdminOrOwner(req.me);
    const siteId = String(req.params.siteId);

    const teams = await prisma.coreTeam.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        siteId: true,
        manager: { select: { id: true, username: true } },
        _count: { select: { members: true } },
      },
    });
    res.json(teams);
  } catch (e) { next(e); }
});

/**
 * POST /api/admin/sites/:siteId/teams
 * - ADMIN & OWNER
 * - scopedToSite : OWNER doit être membre du site (ADMIN bypass)
 */
r.post('/sites/:siteId/teams', requireAuth, scopedToSite, async (req, res, next) => {
  try {
    ensureAdminOrOwner(req.me);
    const siteId = String(req.params.siteId);
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    const created = await prisma.coreTeam.create({
      data: { name: name.trim(), siteId },
      select: { id: true, name: true, siteId: true },
    });
    res.status(201).json(created);
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Team name already exists' });
    next(e);
  }
});

/**
 * PATCH /api/admin/teams/:id
 * - ADMIN & OWNER
 * - OWNER doit appartenir au site de l’équipe
 */
r.patch('/teams/:id', requireAuth, async (req, res, next) => {
  try {
    ensureAdminOrOwner(req.me);

    const id = String(req.params.id);
    const { name, managerId } = req.body || {};

    const team = await prisma.coreTeam.findUnique({
      where: { id },
      select: { id: true, siteId: true },
    });
    if (!team) return res.status(404).json({ error: 'Not found' });

    if (!isAdmin(req.me)) {
      const siteIds = new Set(req.me.siteIds || []);
      if (!siteIds.has(team.siteId)) return res.status(403).json({ error: 'Wrong site scope' });
    }

    const data = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();

    if (managerId !== undefined) {
      if (managerId === null) {
        data.managerId = null;
      } else {
        const u = await prisma.coreUser.findUnique({
          where: { id: String(managerId) },
          select: {
            id: true,
            role: { select: { name: true } },
            memberships: { select: { siteId: true } },
          },
        });
        if (!u) return res.status(400).json({ error: 'Invalid managerId' });
        const sameSite = (u.memberships || []).some(m => m.siteId === team.siteId);
        if (!sameSite) return res.status(400).json({ error: 'Manager not in the same site' });
        if (!['MANAGER', 'OWNER', 'ADMIN'].includes(u.role?.name)) {
          return res.status(400).json({ error: 'User is not a manager/owner/admin' });
        }
        data.managerId = u.id;
      }
    }

    const updated = await prisma.coreTeam.update({
      where: { id },
      data,
      select: { id: true, name: true, siteId: true, managerId: true },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

/**
 * DELETE /api/admin/teams/:id
 * - ADMIN & OWNER
 * - OWNER doit appartenir au site de l’équipe
 * - Refuse si l’équipe a des membres
 */
r.delete('/teams/:id', requireAuth, async (req, res, next) => {
  try {
    ensureAdminOrOwner(req.me);

    const id = String(req.params.id);
    const team = await prisma.coreTeam.findUnique({
      where: { id },
      select: { id: true, siteId: true, _count: { select: { members: true } } },
    });
    if (!team) return res.status(404).json({ error: 'Not found' });

    if (!isAdmin(req.me)) {
      const siteIds = new Set(req.me.siteIds || []);
      if (!siteIds.has(team.siteId)) return res.status(403).json({ error: 'Wrong site scope' });
    }

    if (team._count.members > 0) {
      return res.status(409).json({ error: 'Team has members' });
    }

    await prisma.coreTeam.delete({ where: { id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = r;
