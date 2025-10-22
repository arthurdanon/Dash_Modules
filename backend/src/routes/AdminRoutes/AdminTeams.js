// backend/src/routes/AdminRoutes/AdminTeams.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, scopedToSite } = require('../../mw/auth');
const { validate } = require('../../mw/validate');

const prisma = new PrismaClient();
const r = Router();

const isAdmin = (me) => !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN';
const isOwner = (me) => !!me?.isOwner || String(me?.role).toUpperCase() === 'OWNER';

/** POST /api/admin/sites/:siteId/teams  (ADMIN & OWNER) */
r.post(
  '/sites/:siteId/teams',
  requireAuth,
  scopedToSite,
  validate({
    params: z.object({ siteId: z.string().min(1) }),
    body: z.object({ name: z.string().trim().min(1, 'Nom requis') }),
  }),
  async (req, res) => {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

    const { siteId } = req.params;
    const { name } = req.body;

    const created = await prisma.coreTeam.create({
      data: { name: name.trim(), siteId: String(siteId) },
      select: { id: true, name: true, siteId: true },
    });
    res.status(201).json(created);
  }
);

/** PATCH /api/admin/teams/:id  (rename / set manager) — ADMIN & OWNER */
r.patch(
  '/teams/:id',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      name: z.string().trim().min(1).optional(),
      managerId: z.string().nullable().optional(),
    }),
  }),
  async (req, res) => {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

    const id = String(req.params.id);
    const { name, managerId } = req.body;

    const team = await prisma.coreTeam.findUnique({
      where: { id },
      select: { id: true, siteId: true },
    });
    if (!team) return res.status(404).json({ error: 'Not found' });

    // OWNER doit être membre du site de l’équipe
    if (!isAdmin(me) && !(req.me.siteIds || []).includes(team.siteId)) {
      return res.status(403).json({ error: 'Wrong site scope' });
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
        const sameSite = u.memberships.some(m => m.siteId === team.siteId);
        if (!sameSite) return res.status(400).json({ error: 'Manager not in the same site' });
        if (!['MANAGER', 'OWNER', 'ADMIN'].includes(u.role?.name)) {
          return res.status(400).json({ error: 'User is not a manager/owner/admin' });
        }
        data.managerId = u.id;
      }
    }

    const updated = await prisma.coreTeam.update({ where: { id }, data });
    res.json(updated);
  }
);

/** DELETE /api/admin/teams/:id — ADMIN & OWNER; refuse si membres */
r.delete(
  '/teams/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res) => {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

    const id = String(req.params.id);
    const team = await prisma.coreTeam.findUnique({
      where: { id },
      select: { id: true, siteId: true, _count: { select: { members: true } } },
    });
    if (!team) return res.status(404).json({ error: 'Not found' });

    if (!isAdmin(me) && !(req.me.siteIds || []).includes(team.siteId)) {
      return res.status(403).json({ error: 'Wrong site scope' });
    }
    if (team._count.members > 0) {
      return res.status(409).json({ error: 'Team has members' });
    }

    await prisma.coreTeam.delete({ where: { id } });
    res.status(204).send();
  }
);

module.exports = r;
