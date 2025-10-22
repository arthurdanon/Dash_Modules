// backend/src/routes/GeneralRoutes/GeneralTeams.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, scopedToSite } = require('../../mw/auth');
const { validate } = require('../../mw/validate');

const prisma = new PrismaClient();
const r = Router();

/** GET /api/sites/:siteId/teams (lecture seule) */
r.get(
  '/sites/:siteId/teams',
  requireAuth,
  scopedToSite,
  validate({ params: z.object({ siteId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const siteId = String(req.params.siteId);
      const teams = await prisma.coreTeam.findMany({
        where: { siteId },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, siteId: true,
          manager: { select: { id: true, username: true } },
          _count: { select: { members: true } },
        },
      });
      res.json(teams);
    } catch (e) { next(e); }
  }
);

module.exports = r;
