const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdmin, requireManager, scopedToSite } = require('../mw/auth');
const { hash } = require('../lib/auth');
const { encryptPassword, decryptPassword } = require('../lib/crypto');
const { customAlphabet } = require('nanoid');

const prisma = new PrismaClient();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const r = Router();

const RESERVED = ['ADMIN', 'MANAGER'];

/**
 * Créer un utilisateur sur un site
 * - ADMIN peut créer ADMIN / MANAGER / rôles simples, sur n'importe quel site
 * - MANAGER peut créer MANAGER + rôles simples mais uniquement sur son propre site
 * - Rôles simples = isAdmin=false & isManager=false (créés via /roles)
 */
r.post('/sites/:siteId/users', requireAuth, scopedToSite, async (req, res) => {
  try {
    const me = req.me; // me.role.isAdmin / me.role.isManager / me.siteId
    const { siteId } = req.params;
    const { roleId, roleName, teamId, firstName, lastName, username } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !username?.trim()) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Récupérer le rôle demandé
    let role = null;
    if (roleId) role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role && roleName) role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const roleNameUp = role.name.toUpperCase();
    const isReserved = RESERVED.includes(roleNameUp);

    // Autorisations selon le rôle ciblé
    if (isReserved) {
      // ADMIN -> peut créer ADMIN & MANAGER
      if (roleNameUp === 'ADMIN') {
        if (!me.role.isAdmin) return res.status(403).json({ error: 'Only admin can create admin users' });
      }
      if (roleNameUp === 'MANAGER') {
        // admin OK partout; manager OK mais uniquement sur son site
        if (!me.role.isAdmin && !me.role.isManager) {
          return res.status(403).json({ error: 'Only admin/manager can create manager users' });
        }
        if (me.role.isManager && me.siteId !== siteId) {
          return res.status(403).json({ error: 'Manager can only create manager users on own site' });
        }
      }
    } else {
      // Rôle "user simple" → admin OK partout ; manager limité à son site
      if (!me.role.isAdmin && !me.role.isManager) {
        return res.status(403).json({ error: 'Only admin/manager can create users' });
      }
      if (me.role.isManager && me.siteId !== siteId) {
        return res.status(403).json({ error: 'Manager can only create users on own site' });
      }
      // sécurité défensive : un rôle "simple" ne doit pas avoir de flags
      if (role.isAdmin || role.isManager) {
        return res.status(400).json({ error: 'Target role must be a simple user role' });
      }
    }

    // Génération + stockage du mot de passe
    const plainPwd = nanoid();
    const passwordHash = await hash(plainPwd);
    const { enc, iv, tag } = encryptPassword(plainPwd);

    // Si on crée un MANAGER, on lui associe le site en tant que managedSiteId
    const managedSiteId = roleNameUp === 'MANAGER' ? siteId : null;

    const user = await prisma.user.create({
      data: {
        roleId: role.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        passwordHash,
        passwordEnc: enc,
        passwordIv: iv,
        passwordTag: tag,
        mustChangePwd: true,
        siteId,
        teamId: teamId ?? null,
        managedSiteId,
      },
      select: { id: true, username: true, siteId: true },
    });

    return res.json({ user, generatedPassword: plainPwd });
  } catch (e) {
    if (e?.code === 'P2002' && e?.meta?.target?.includes('User_username_key')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Lister les utilisateurs
 * - Admin : tous
 * - Manager : uniquement son site, exclure admins
 * - User : 403
 */
r.get('/users', requireAuth, async (req, res) => {
  const me = req.me;
  if (!me.role.isAdmin && !me.role.isManager) return res.status(403).json({ error: 'Forbidden' });

  const where = me.role.isAdmin
    ? {}
    : { siteId: me.siteId, role: { isAdmin: false } };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { site: true, role: true },
  });
  res.json(users);
});

/**
 * Supprimer un utilisateur
 * - Admin : tous
 * - Manager : son site, non-admin
 * - User : 403
 */
r.delete('/users/:id', requireAuth, async (req, res) => {
  const me = req.me;
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });
  if (!u) return res.status(404).json({ error: 'Not found' });

  if (me.role.isAdmin) {
    // ok
  } else if (me.role.isManager) {
    if (u.role.isAdmin) return res.status(403).json({ error: 'Cannot delete admin' });
    if (u.siteId !== me.siteId) return res.status(403).json({ error: 'Cross-site forbidden' });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await prisma.user.delete({ where: { id: u.id } });
  res.json({ ok: true });
});

/**
 * Lire le mot de passe en clair
 * - Admin : ok
 * - Manager : ok pour son site, non-admin
 * - User : 403
 */
r.get('/users/:userId/password', requireAuth, async (req, res) => {
  const me = req.me;
  const u = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { role: true },
  });
  if (!u) return res.status(404).json({ error: 'Not found' });

  if (me.role.isAdmin) {
    // ok
  } else if (me.role.isManager) {
    if (u.role.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (me.siteId !== u.siteId) return res.status(403).json({ error: 'Forbidden' });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!u.passwordEnc || !u.passwordIv || !u.passwordTag) {
    return res.status(404).json({ error: 'No stored password' });
  }
  const plain = decryptPassword(u.passwordEnc, u.passwordIv, u.passwordTag);
  res.json({ username: u.username, password: plain });
});

module.exports = r;
