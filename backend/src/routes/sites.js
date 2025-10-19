// backend/src/routes/sites.js
const { Router } = require('express');
const { PrismaClient, RoleName } = require('@prisma/client');
const { requireAuth, requireAdmin } = require('../mw/auth');

const prisma = new PrismaClient();
const r = Router();

/**
 * GET /api/sites
 * Liste des sites + compteurs par rôle
 */
r.get('/sites', requireAuth, async (_req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      sites.map(async (s) => {
        const [adminsCount, ownersCount, managersCount, usersCount] = await Promise.all([
          prisma.user.count({ where: { siteId: s.id, role: RoleName.ADMIN } }),
          prisma.user.count({ where: { siteId: s.id, role: RoleName.OWNER } }),
          prisma.user.count({ where: { siteId: s.id, role: RoleName.MANAGER } }),
          prisma.user.count({ where: { siteId: s.id, role: RoleName.USER } }),
        ]);

        return {
          ...s,
          adminsCount,
          ownersCount,
          managersCount,
          usersCount,
        };
      })
    );

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/sites
 * Création de site (ADMIN uniquement)
 */
r.post('/sites', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });

    const site = await prisma.site.create({ data: { name } });
    return res.status(201).json(site);
  } catch (e) {
    // Conflit nom unique
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Site name already exists' });
    }
    next(e);
  }
});

/**
 * DELETE /api/sites/:id
 * Suppression de site (ADMIN uniquement)
 */
r.delete('/sites/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    // Optionnel: vérifier existence pour renvoyer 404 propre
    const exists = await prisma.site.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Not found' });

    await prisma.site.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

module.exports = r;
