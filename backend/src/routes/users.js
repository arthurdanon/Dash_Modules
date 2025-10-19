// src/routes/users.js
const { Router } = require('express');
const { PrismaClient, RoleName } = require('@prisma/client');
const { requireAuth, scopedToSite } = require('../mw/auth');
const { hash } = require('../lib/auth');
const { encryptPassword, decryptPassword } = require('../lib/crypto');
const { customAlphabet } = require('nanoid');

const prisma = new PrismaClient();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const r = Router();

/* Helpers role (req.me.role est une string/enum) */
const isAdmin   = (role) => role === RoleName.ADMIN   || role === 'ADMIN';
const isOwner   = (role) => role === RoleName.OWNER   || role === 'OWNER';
const isManager = (role) => role === RoleName.MANAGER || role === 'MANAGER';

/**
 * POST /api/sites/:siteId/users
 * Créer un utilisateur sur un site
 * - ADMIN : peut créer tous les rôles (mais on force UN SEUL ADMIN au global)
 * - OWNER : peut créer OWNER / MANAGER / USER sur SON site (jamais ADMIN)
 *   (optionnel) un seul OWNER par site
 * - MANAGER : peut créer USER sur SON site (jamais ADMIN/OWNER/MANAGER)
 * - défaut : role = USER si non fourni
 */
r.post('/sites/:siteId/users', requireAuth, scopedToSite, async (req, res, next) => {
  try {
    const me = req.me;
    const siteId = String(req.params.siteId);
    const { role: rawRole, firstName, lastName, username } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !username?.trim()) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Normalise le rôle demandé
    let targetRole = (rawRole || RoleName.USER).toString().toUpperCase();
    if (!Object.values(RoleName).includes(targetRole)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${Object.values(RoleName).join(', ')}` });
    }

    // Autorisations
    if (isAdmin(me.role)) {
      // Un seul ADMIN au global
      if (targetRole === RoleName.ADMIN) {
        const adminCount = await prisma.user.count({ where: { role: RoleName.ADMIN } });
        if (adminCount >= 1) return res.status(403).json({ error: 'An ADMIN already exists' });
      }
    } else if (isOwner(me.role)) {
      // OWNER: uniquement sur son site
      if (me.siteId !== siteId) return res.status(403).json({ error: 'Owner can only create users on own site' });
      // OWNER: jamais d'ADMIN
      if (targetRole === RoleName.ADMIN) return res.status(403).json({ error: 'Only ADMIN can create ADMIN users' });
      // (Optionnel) un seul OWNER par site
      if (targetRole === RoleName.OWNER) {
        const owners = await prisma.user.count({ where: { siteId, role: RoleName.OWNER } });
        if (owners >= 1) return res.status(403).json({ error: 'An OWNER already exists for this site' });
      }
    } else if (isManager(me.role)) {
      // MANAGER: uniquement sur son site
      if (me.siteId !== siteId) return res.status(403).json({ error: 'Manager can only create users on own site' });
      // MANAGER: peut créer uniquement USER
      if (targetRole !== RoleName.USER) {
        return res.status(403).json({ error: 'Manager can only create USER' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Génère + stocke le mot de passe
    const plainPwd = nanoid();
    const passwordHash = await hash(plainPwd);
    const { enc, iv, tag } = encryptPassword(plainPwd);

    // Si on crée un MANAGER, le rattacher en tant que managedSite
    const managedSiteId = targetRole === RoleName.MANAGER ? siteId : null;

    const user = await prisma.user.create({
      data: {
        role: targetRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        passwordHash,
        passwordEnc: enc,
        passwordIv: iv,
        passwordTag: tag,
        mustChangePwd: true,
        siteId,
        managedSiteId,
      },
      select: { id: true, username: true, role: true, siteId: true },
    });

    return res.status(201).json({ user, generatedPassword: plainPwd });
  } catch (e) {
    if (e?.code === 'P2002' && e?.meta?.target?.includes('User_username_key')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    next(e);
  }
});

/**
 * GET /api/users
 * - ADMIN : tous
 * - OWNER : uniquement son site, exclut ADMIN
 * - MANAGER : uniquement son site, exclut ADMIN
 * - USER : 403
 */
r.get('/users', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;

    if (isAdmin(me.role)) {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { site: true, team: true },
      });
      return res.json(users);
    }

    if (isOwner(me.role) || isManager(me.role)) {
      const users = await prisma.user.findMany({
        where: { siteId: me.siteId, NOT: { role: RoleName.ADMIN } },
        orderBy: { createdAt: 'desc' },
        include: { site: true, team: true },
      });
      return res.json(users);
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/users/:id
 * - ADMIN : peut supprimer, SAUF le dernier ADMIN
 * - OWNER : peut supprimer sur son site (jamais ADMIN ni OWNER)
 * - MANAGER : peut supprimer sur son site (jamais ADMIN)
 * - USER : 403
 */
r.delete('/users/:id', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const id = String(req.params.id);

    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return res.status(404).json({ error: 'Not found' });

    if (isAdmin(me.role)) {
      if (u.role === RoleName.ADMIN) {
        const adminCount = await prisma.user.count({ where: { role: RoleName.ADMIN } });
        if (adminCount <= 1) return res.status(403).json({ error: 'Cannot delete the last ADMIN' });
      }
    } else if (isOwner(me.role)) {
      if (u.siteId !== me.siteId) return res.status(403).json({ error: 'Cross-site forbidden' });
      if (u.role === RoleName.ADMIN || u.role === RoleName.OWNER) {
        return res.status(403).json({ error: 'Owner cannot delete ADMIN/OWNER' });
      }
    } else if (isManager(me.role)) {
      if (u.role === RoleName.ADMIN) return res.status(403).json({ error: 'Cannot delete admin' });
      if (u.siteId !== me.siteId) return res.status(403).json({ error: 'Cross-site forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.user.delete({ where: { id: u.id } });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/users/:userId/password
 * - ADMIN : ok
 * - OWNER : ok sur son site pour MANAGER/USER (pas ADMIN/OWNER)
 * - MANAGER : ok sur son site pour non-ADMIN (USER/évent. MANAGER ? ici on permet USER uniquement)
 */
r.get('/users/:userId/password', requireAuth, async (req, res, next) => {
  try {
    const me = req.me;
    const userId = String(req.params.userId);

    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) return res.status(404).json({ error: 'Not found' });

    if (isAdmin(me.role)) {
      // ok
    } else if (isOwner(me.role)) {
      if (me.siteId !== u.siteId) return res.status(403).json({ error: 'Forbidden' });
      if (u.role === RoleName.ADMIN || u.role === RoleName.OWNER) return res.status(403).json({ error: 'Forbidden' });
    } else if (isManager(me.role)) {
      if (me.siteId !== u.siteId) return res.status(403).json({ error: 'Forbidden' });
      if (u.role === RoleName.ADMIN) return res.status(403).json({ error: 'Forbidden' });
      // si tu veux restreindre manager -> uniquement USER, décommente:
      // if (u.role !== RoleName.USER) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!u.passwordEnc || !u.passwordIv || !u.passwordTag) {
      return res.status(404).json({ error: 'No stored password' });
    }
    const plain = decryptPassword(u.passwordEnc, u.passwordIv, u.passwordTag);
    return res.json({ username: u.username, password: plain });
  } catch (e) {
    next(e);
  }
});

module.exports = r;
