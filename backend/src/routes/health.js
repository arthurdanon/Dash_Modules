// backend/src/routes/health.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const r = Router();

// Liveness
r.get('/healthz', (_req, res) => res.json({ ok: true }));

// Readiness (DB OK)
r.get('/readyz', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: 'ok' });
  } catch (e) { next(e); }
});

module.exports = r;
