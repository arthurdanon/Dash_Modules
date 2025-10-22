// backend/src/routes/GeneralRoutes/GeneralRoles.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

/** GET /api/roles — lecture simple des rôles supportés */
r.get('/roles', requireAuth, async (_req, res, next) => {
  try {
    const roles = await prisma.coreRole.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    // fallback si la table est vide
    const arr = roles?.length ? roles.map(r => r.name) : ['ADMIN', 'OWNER', 'MANAGER', 'USER'];
    res.json(arr);
  } catch (e) { next(e); }
});

module.exports = r;
