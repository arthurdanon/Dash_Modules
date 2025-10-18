// backend/src/routes/plans.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdmin } = require('../mw/auth');

const prisma = new PrismaClient();
const r = Router();

// Lister tous les plans
r.get('/admin/plans', requireAuth, requireAdmin, async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { priceCents: 'asc' },
  });
  res.json(plans);
});

// Créer un plan
r.post('/admin/plans', requireAuth, requireAdmin, async (req, res) => {
  const { name, maxSites, maxManagers, maxUsers, priceCents } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name,
      maxSites: Number(maxSites ?? 0),
      maxManagers: Number(maxManagers ?? 0),
      maxUsers: Number(maxUsers ?? 0),
      priceCents: Number(priceCents ?? 0),
    },
  });
  res.json(plan);
});

// Mettre à jour un plan
r.patch('/admin/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, maxSites, maxManagers, maxUsers, priceCents } = req.body;

  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(maxSites !== undefined ? { maxSites: Number(maxSites) } : {}),
      ...(maxManagers !== undefined ? { maxManagers: Number(maxManagers) } : {}),
      ...(maxUsers !== undefined ? { maxUsers: Number(maxUsers) } : {}),
      ...(priceCents !== undefined ? { priceCents: Number(priceCents) } : {}),
    },
  });
  res.json(plan);
});

// Supprimer un plan (refus si utilisé par un abonnement)
r.delete('/admin/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const inUse = await prisma.subscription.count({ where: { planId: id } });
  if (inUse > 0) {
    return res.status(409).json({ error: 'Plan in use by subscriptions' });
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  res.json({ ok: true });
});

// Assigner (ou changer) un plan à un propriétaire
r.post('/admin/owners/:ownerId/subscription', requireAuth, requireAdmin, async (req, res) => {
  const { ownerId } = req.params;
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId required' });

  // Pause les précédents actifs
  await prisma.subscription.updateMany({
    where: { ownerId, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
  });

  // Active la nouvelle souscription
  const sub = await prisma.subscription.create({
    data: { ownerId, planId, status: 'ACTIVE' },
  });

  res.json(sub);
});

module.exports = r;
