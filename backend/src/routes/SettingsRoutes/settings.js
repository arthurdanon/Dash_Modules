// backend/src/routes/SettingsRoutes/settings.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, requireAdmin } = require('../../mw/auth');
const { validate } = require('../../mw/validate');

const prisma = new PrismaClient();
const r = Router();

// Toutes ces routes sont Admin-only
r.use(requireAuth, requireAdmin);

/** GET /api/settings/settings-list */
r.get('/settings-list', async (_req, res) => {
  const s = await prisma.coreSetting.findMany({
    select: {
      id: true, name: true,
      maxSites: true, maxOwners: true, maxManagers: true, maxUsers: true,
      availableModules: true,
      sites: { select: { id: true, name: true, modules: true } },
      createdAt: true, updatedAt: true,
    },
  });
  res.json(s);
});

/** PATCH /api/settings/settings/:id */
r.patch(
  '/settings/:id',
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      name: z.string().trim().min(1).optional(),
      maxSites: z.number().int().min(0).nullable().optional(),
      maxOwners: z.number().int().min(0).nullable().optional(),
      maxManagers: z.number().int().min(0).nullable().optional(),
      maxUsers: z.number().int().min(0).nullable().optional(),
      availableModules: z.record(z.boolean()).optional(),
    }),
  }),
  async (req, res) => {
    const { id } = req.params;
    const { name, maxSites, maxOwners, maxManagers, maxUsers, availableModules } = req.body || {};
    const data = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (maxSites !== undefined)    data.maxSites = maxSites;
    if (maxOwners !== undefined)   data.maxOwners = maxOwners;
    if (maxManagers !== undefined) data.maxManagers = maxManagers;
    if (maxUsers !== undefined)    data.maxUsers = maxUsers;
    if (availableModules !== undefined) data.availableModules = availableModules;

    const s = await prisma.coreSetting.update({ where: { id }, data });
    res.json(s);
  }
);

/** PATCH /api/settings/settings-sites/:siteId/modules */
r.patch(
  '/settings-sites/:siteId/modules',
  validate({
    params: z.object({ siteId: z.string().min(1) }),
    body: z.object({ modules: z.record(z.boolean()) }),
  }),
  async (req, res) => {
    const { siteId } = req.params;
    const { modules } = req.body || {};
    const site = await prisma.coreSite.update({
      where: { id: String(siteId) },
      data: { modules: modules || {} },
      select: { id: true, name: true, modules: true },
    });
    res.json(site);
  }
);

module.exports = r;
