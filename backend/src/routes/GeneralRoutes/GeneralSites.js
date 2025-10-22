// backend/src/routes/GeneralRoutes/GeneralSites.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth } = require('../../mw/auth');
const { validate } = require('../../mw/validate');

const prisma = new PrismaClient();
const r = Router();

const userIsAdmin = (me) => !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN';

/**
 * GET /api/sites
 * - Admin : tous les sites
 * - Sinon : sites dont je suis membre
 * + managersCount (MANAGER uniquement), usersCount (USER uniquement)
 */
r.get('/sites', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const where = userIsAdmin(me) ? {} : { members: { some: { userId: me.id } } };

    const sites = await prisma.coreSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
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
  } catch (e) { next(e); }
});

/**
 * GET /api/sites/:siteId
 * - Admin : OK
 * - Sinon : doit être membre du site
 */
r.get(
  '/sites/:siteId',
  requireAuth,
  validate({ params: z.object({ siteId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const me = req.me;
      const siteId = String(req.params.siteId);

      if (!userIsAdmin(me)) {
        const member = await prisma.coreSiteMember.findFirst({
          where: { userId: me.id, siteId },
          select: { id: true },
        });
        if (!member) return res.status(403).json({ error: 'Forbidden' });
      }

      const s = await prisma.coreSite.findUnique({ where: { id: siteId } });
      if (!s) return res.status(404).json({ error: 'Not found' });
      res.json(s);
    } catch (e) { next(e); }
  }
);

module.exports = r;
