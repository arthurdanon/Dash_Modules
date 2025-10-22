const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

r.get('/roles', requireAuth, async (_req, res) => {
  const roles = await prisma.coreRole.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isAdmin: true, isOwner: true, isManager: true },
  });
  res.json(roles.map(r => r.name)); // ou renvoie l’objet complet si tu préfères
});

module.exports = r;
