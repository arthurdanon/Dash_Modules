// backend/src/routes/sites.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdmin } = require('../mw/auth');
const prisma = new PrismaClient();
const r = Router();

// Liste des sites + compteurs (managers / users simples)
r.get('/sites', requireAuth, async (req, res) => {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const enriched = await Promise.all(
    sites.map(async (s) => {
      const [managersCount, usersCount] = await Promise.all([
        prisma.user.count({
          where: { siteId: s.id, role: { isManager: true } },
        }),
        prisma.user.count({
          where: { siteId: s.id, role: { isAdmin: false, isManager: false } },
        }),
      ]);

      return {
        ...s,
        managersCount,
        usersCount,
      };
    })
  );

  res.json(enriched);
});

// Création de site (ADMIN uniquement)
r.post('/sites', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;
  const site = await prisma.site.create({ data: { name } });
  res.json(site);
});

// Suppression de site (ADMIN uniquement)
r.delete('/sites/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.site.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = r;
