// backend/src/routes/AdminRoutes/AdminSites.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth } = require('../../mw/auth');
const { validate } = require('../../mw/validate');

const prisma = new PrismaClient();
const r = Router();

const isAdmin = (me) => !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN';
const isOwner = (me) => !!me?.isOwner || String(me?.role).toUpperCase() === 'OWNER';

/** Helper: check quotas maxSites (via premier coreSetting) */
async function enforceMaxSitesOrThrow() {
  const setting = await prisma.coreSetting.findFirst({
    select: { id: true, maxSites: true },
  });
  if (!setting) return;
  if (setting.maxSites == null) return;

  const count = await prisma.coreSite.count();
  if (count >= setting.maxSites) {
    const err = new Error('Site quota reached');
    err.status = 403;
    throw err;
  }
}

/** GET /api/admin/sites — ADMIN & OWNER: liste complète */
r.get('/sites', requireAuth, async (req, res) => {
  const me = req.me;
  if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

  const sites = await prisma.coreSite.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, modules: true, createdAt: true },
  });
  res.json(sites);
});

/** POST /api/admin/sites — ADMIN & OWNER: créer un site */
r.post(
  '/sites',
  requireAuth,
  validate({ body: z.object({ name: z.string().trim().min(1, 'Nom requis') }) }),
  async (req, res, next) => {
    try {
      const me = req.me;
      if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

      await enforceMaxSitesOrThrow();

      const created = await prisma.coreSite.create({
        data: { name: req.body.name.trim(), modules: {} },
        select: { id: true, name: true, modules: true },
      });
      res.status(201).json(created);
    } catch (e) { next(e); }
  }
);

/** PATCH /api/admin/sites/:id — ADMIN & OWNER (OWNER doit être membre du site) */
r.patch(
  '/sites/:id',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ name: z.string().trim().min(1).optional() }),
  }),
  async (req, res) => {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

    const id = String(req.params.id);

    if (!isAdmin(me)) {
      const member = await prisma.coreSiteMember.findFirst({
        where: { userId: me.id, siteId: id },
        select: { id: true },
      });
      if (!member) return res.status(403).json({ error: 'Wrong site scope' });
    }

    const data = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();

    const updated = await prisma.coreSite.update({
      where: { id },
      data,
      select: { id: true, name: true, modules: true },
    });
    res.json(updated);
  }
);

/** DELETE /api/admin/sites/:id — ADMIN & OWNER (OWNER doit être membre) ; refuse si non-vide */
r.delete(
  '/sites/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res) => {
    const me = req.me;
    if (!(isAdmin(me) || isOwner(me))) return res.status(403).json({ error: 'Forbidden' });

    const id = String(req.params.id);

    if (!isAdmin(me)) {
      const member = await prisma.coreSiteMember.findFirst({
        where: { userId: me.id, siteId: id },
        select: { id: true },
      });
      if (!member) return res.status(403).json({ error: 'Wrong site scope' });
    }

    // Refuse la suppression si le site a des équipes ou des membres
    const counts = await prisma.coreSite.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            teams: true,
            members: true,
          },
        },
      },
    });
    if (!counts) return res.status(404).json({ error: 'Not found' });

    if ((counts._count?.teams || 0) > 0 || (counts._count?.members || 0) > 0) {
      return res.status(409).json({ error: 'Site not empty' });
    }

    await prisma.coreSite.delete({ where: { id } });
    res.status(204).send();
  }
);

module.exports = r;
