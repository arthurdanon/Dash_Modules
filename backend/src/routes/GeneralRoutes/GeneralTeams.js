// backend/src/routes/teams.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, scopedToSite } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

/**
 * GET /api/sites/:siteId/teams
 * - Auth requis
 * - Doit être membre du site (scopedToSite gère le scope ou bypass pour ADMIN)
 */
r.get('/sites/:siteId/teams', requireAuth, scopedToSite, async (req, res, next) => {
  try {
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

module.exports = r;
