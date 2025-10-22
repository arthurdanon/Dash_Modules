// backend/src/routes/AdminRoutes/settingsRoutes.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdmin } = require('../../mw/auth');

const prisma = new PrismaClient();
const r = Router();

r.use(requireAuth, requireAdmin);

/**
 * GET /api/settings/settings-list
 * Liste des CoreSetting (sélectionne aussi les sites & modules)
 */
r.get('/settings-list', async (_req, res, next) => {
  try {
    const s = await prisma.coreSetting.findMany({
      select: {
        id: true,
        name: true,
        maxSites: true,
        maxOwners: true,
        maxManagers: true,
        maxUsers: true,
        availableModules: true,
        sites: { select: { id: true, name: true, modules: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(s);
  } catch (e) { next(e); }
});

/**
 * PATCH /api/settings/settings/:id
 * Mise à jour des limites & du catalogue de modules
 */
r.patch('/settings/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      maxSites,
      maxOwners,
      maxManagers,
      maxUsers,
      availableModules,
    } = req.body || {};

    const data = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();

    const numberOrNull = (v) =>
      v === null ? null : (v === undefined ? undefined : Number(v));

    const safe = (v) => {
      const n = numberOrNull(v);
      if (n === undefined) return undefined;
      if (n === null) return null;
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    const ms = safe(maxSites);
    const mo = safe(maxOwners);
    const mm = safe(maxManagers);
    const mu = safe(maxUsers);

    if (ms !== undefined) data.maxSites = ms;
    if (mo !== undefined) data.maxOwners = mo;
    if (mm !== undefined) data.maxManagers = mm;
    if (mu !== undefined) data.maxUsers = mu;

    if (availableModules !== undefined) data.availableModules = availableModules;

    const s = await prisma.coreSetting.update({
      where: { id: String(id) },
      data,
      select: {
        id: true,
        name: true,
        maxSites: true,
        maxOwners: true,
        maxManagers: true,
        maxUsers: true,
        availableModules: true,
        updatedAt: true,
      },
    });

    res.json(s);
  } catch (e) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Setting not found' });
    next(e);
  }
});

/**
 * PATCH /api/settings/settings-sites/:siteId/modules
 * Active/désactive des modules sur un site
 */
r.patch('/settings-sites/:siteId/modules', async (req, res, next) => {
  try {
    const { siteId } = req.params;
    const { modules } = req.body || {};

    if (modules && typeof modules !== 'object') {
      return res.status(400).json({ error: 'modules must be an object' });
    }

    const site = await prisma.coreSite.update({
      where: { id: String(siteId) },
      data: { modules: modules || {} },
      select: { id: true, name: true, modules: true, updatedAt: true },
    });

    res.json(site);
  } catch (e) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Site not found' });
    next(e);
  }
});

module.exports = r;
