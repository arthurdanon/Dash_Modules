// backend/src/routes/admin/adminUsers.routes.js
const { Router } = require('express');
const { PrismaClient, CoreAuthTokenType } = require('@prisma/client');
const { requireAuth, requireManager, scopedToSite } = require('../../mw/auth');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { validate } = require('../../mw/validate');
const { makeRawToken, hashToken, addMs } = require('../../lib/tokens');
const { sendMail } = require('../../lib/mailer');

const prisma = new PrismaClient();
const r = Router();

// Protection de base: MANAGER+ (OWNER, ADMIN inclus)
r.use(requireAuth, requireManager);

// Helpers rôle (utilisent soit flags, soit role.name)
const isAdmin   = (me) => !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN';
const isOwner   = (me) => !!me?.isOwner || String(me?.role).toUpperCase() === 'OWNER';
const isManager = (me) => !!me?.isManager || String(me?.role).toUpperCase() === 'MANAGER';

// ------- Quotas utilitaires (identiques conceptuellement à ta version) -----
async function getSettingForSite(siteId) {
  const site = await prisma.coreSite.findUnique({
    where: { id: String(siteId) },
    select: {
      id: true,
      settingId: true,
      setting: { select: { id: true, maxOwners: true, maxManagers: true, maxUsers: true } },
    },
  });
  if (!site) return null;
  return {
    settingId: site.settingId,
    quotas: {
      OWNER: site.setting?.maxOwners ?? null,
      MANAGER: site.setting?.maxManagers ?? null,
      USER: site.setting?.maxUsers ?? null,
    },
  };
}

async function countUsersInSettingByRole(settingId, roleName) {
  return prisma.coreUser.count({
    where: {
      role: { name: roleName },
      memberships: { some: { site: { settingId: String(settingId) } } },
    },
  });
}

async function enforceRoleQuotaOrThrow(settingId, roleName) {
  const role = String(roleName).toUpperCase();
  if (!['OWNER', 'MANAGER', 'USER'].includes(role)) return;
  const s = await prisma.coreSetting.findUnique({
    where: { id: String(settingId) },
    select: { maxOwners: true, maxManagers: true, maxUsers: true },
  });
  if (!s) return;

  const limit =
    role === 'OWNER'   ? s.maxOwners :
    role === 'MANAGER' ? s.maxManagers :
    role === 'USER'    ? s.maxUsers :
    null;
  if (limit == null) return;

  const current = await countUsersInSettingByRole(settingId, role);
  if (current >= limit) {
    const label = role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : 'User';
    const err = new Error(`${label} quota reached`);
    err.status = 403;
    throw err;
  }
}

// ---------------------------- Schemas Zod ---------------------------------
const RoleName = z.enum(['ADMIN', 'OWNER', 'MANAGER', 'USER']);

const CreateUserBody = z.object({
  role: RoleName,
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  username: z.string().trim().min(3),
  email: z.string().email(),
  teamId: z.string().optional().nullable(),
});

const PatchUserBody = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  role: RoleName.optional(),
  isActive: z.boolean().optional(),
  primarySiteId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  addSites: z.array(z.string()).default([]).optional(),
  removeSites: z.array(z.string()).default([]).optional(),
});

// ------------------------------ Stats -------------------------------------
r.get('/users/stats', async (req, res, next) => {
  try {
    // settingId pour l’acteur (admin/owner = global 1er setting)
    let settingId = null;
    if (isAdmin(req.me) || isOwner(req.me)) {
      const s = await prisma.coreSetting.findFirst({ select: { id: true } });
      settingId = s?.id || null;
    } else {
      // Manager: premier site où il est membre
      const any = await prisma.coreSiteMember.findFirst({
        where: { userId: req.me.id },
        select: { site: { select: { settingId: true } } },
      });
      settingId = any?.site?.settingId || null;
    }
    if (!settingId) return res.status(404).json({ error: 'No setting context' });

    const s = await prisma.coreSetting.findUnique({
      where: { id: settingId },
      select: { maxOwners: true, maxManagers: true, maxUsers: true },
    });
    if (!s) return res.status(404).json({ error: 'Setting not found' });

    const [owners, managers, users] = await Promise.all([
      countUsersInSettingByRole(settingId, 'OWNER'),
      countUsersInSettingByRole(settingId, 'MANAGER'),
      countUsersInSettingByRole(settingId, 'USER'),
    ]);

    res.json({
      settingId,
      limits: {
        OWNER: s.maxOwners ?? null,
        MANAGER: s.maxManagers ?? null,
        USER: s.maxUsers ?? null,
      },
      counts: { OWNER: owners, MANAGER: managers, USER: users },
    });
  } catch (e) { next(e); }
});

// ------------------------------ Création ----------------------------------
// OWNER/ADMIN : pas d’attribution site/équipe à la création
r.post(
  '/sites/:siteId/users',
  scopedToSite,
  validate({ params: z.object({ siteId: z.string().min(1) }), body: CreateUserBody }),
  async (req, res, next) => {
    try {
      const me = req.me;
      const siteId = String(req.params.siteId);
      const { role, firstName, lastName, username, email, teamId } = req.body;

      const up = role.toUpperCase();
      if (isManager(me) && up !== 'USER') return res.status(403).json({ error: 'Manager can only create USER' });
      if (isOwner(me) && up === 'ADMIN')   return res.status(403).json({ error: 'Only ADMIN can create ADMIN' });

      const settingInfo = await getSettingForSite(siteId);
      if (!settingInfo) return res.status(404).json({ error: 'Site not found' });
      await enforceRoleQuotaOrThrow(settingInfo.settingId, up);

      const data = {
        username: username.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isActive: false,
        mustChangePwd: true,
        role: { connect: { name: up } },
      };

      if (up !== 'OWNER' && up !== 'ADMIN') {
        data.primarySite = { connect: { id: siteId } };
        data.memberships = { create: { siteId, isManager: up === 'MANAGER' } };
        if (teamId) {
          const team = await prisma.coreTeam.findFirst({
            where: { id: String(teamId), siteId },
            select: { id: true },
          });
          if (!team) return res.status(400).json({ error: 'Team does not belong to selected site' });
          data.team = { connect: { id: String(teamId) } };
        }
      }

      const created = await prisma.coreUser.create({
        data,
        select: { id: true, username: true, email: true, firstName: true, lastName: true },
      });

      // Invite
      const raw = makeRawToken();
      const tokenHash = hashToken(raw);
      const expiresAt = addMs(new Date(), 48 * 60 * 60 * 1000);
      await prisma.coreAuthToken.create({
        data: { type: CoreAuthTokenType.INVITE, userId: created.id, tokenHash, expiresAt, meta: { siteId } },
      });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const link = `${appUrl}/set-password?token=${raw}`;
      const html = `
        <p>Bonjour ${created.firstName},</p>
        <p>Un compte a été créé pour vous. Pour définir votre mot de passe :</p>
        <p><a href="${link}">${link}</a></p>
        <p>Ce lien expire dans 48 heures.</p>
      `;
      await sendMail(created.email, 'Activez votre compte', html, { reason: 'invite' });

      res.status(201).json({ user: created, invitationSent: true });
    } catch (e) { next(e); }
  }
);

// ------------------------------- Liste ------------------------------------
r.get('/users', async (req, res, next) => {
  try {
    const me = req.me;
    const baseSelect = {
      id: true, username: true, email: true, firstName: true, lastName: true,
      isActive: true, passwordHash: true,
      team: { select: { id: true, name: true, siteId: true } },
      primarySite: { select: { id: true, name: true } },
      role: { select: { name: true } },
    };

    let users = [];
    if (isAdmin(me)) {
      users = await prisma.coreUser.findMany({ orderBy: { createdAt: 'desc' }, select: baseSelect });
    } else if (isOwner(me)) {
      users = await prisma.coreUser.findMany({
        where: { role: { name: { not: 'ADMIN' } } },
        orderBy: { createdAt: 'desc' },
        select: baseSelect,
      });
    } else {
      users = await prisma.coreUser.findMany({
        where: {
          memberships: { some: { siteId: { in: req.me.siteIds || [] } } },
          role: { name: { not: 'ADMIN' } },
        },
        orderBy: { createdAt: 'desc' },
        select: baseSelect,
      });
    }

    const safe = users.map(({ passwordHash, role, ...u }) => ({
      ...u,
      role: role?.name || 'USER',
      hasPassword: !!passwordHash,
    }));
    res.json(safe);
  } catch (e) { next(e); }
});

// ------------------------------- Lecture détail ---------------------------
r.get('/users/:id/detail', validate({ params: z.object({ id: z.string().min(1) }) }), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const u = await prisma.coreUser.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, firstName: true, lastName: true,
        isActive: true, passwordHash: true,
        primarySiteId: true, teamId: true,
        role: { select: { name: true } },
        memberships: { select: { siteId: true } },
      },
    });
    if (!u) return res.status(404).json({ error: 'Not found' });

    const viewerIsAdmin = isAdmin(req.me);
    if (!viewerIsAdmin && (u.role?.name === 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        hasPassword: !!u.passwordHash,
        primarySiteId: u.primarySiteId || '',
        teamId: u.teamId || '',
        role: { name: u.role?.name || 'USER' },
      },
      membershipSiteIds: (u.memberships || []).map(m => m.siteId),
    });
  } catch (e) { next(e); }
});

// ------------------------------- Edition ----------------------------------
r.patch(
  '/users/:id',
  validate({ params: z.object({ id: z.string().min(1) }), body: PatchUserBody }),
  async (req, res, next) => {
    try {
      const me = req.me;
      const id = String(req.params.id);
      const {
        firstName, lastName, email, role, isActive,
        primarySiteId, teamId, addSites = [], removeSites = [],
      } = req.body;

      const target = await prisma.coreUser.findUnique({
        where: { id },
        select: {
          id: true,
          passwordHash: true,
          primarySiteId: true,
          role: { select: { name: true } },
          memberships: { select: { siteId: true } },
        },
      });
      if (!target) return res.status(404).json({ error: 'Not found' });

      if (!isAdmin(me)) {
        const shared = target.memberships.some(m => (req.me.siteIds || []).includes(m.siteId));
        if (!shared) return res.status(403).json({ error: 'Forbidden' });
        if (role) {
          const up = String(role).toUpperCase();
          if (isManager(me) && up !== 'USER') return res.status(403).json({ error: 'Manager can only set USER' });
          if (isOwner(me) && up === 'ADMIN')   return res.status(403).json({ error: 'Owner cannot set ADMIN' });
        }
        const editorSet = new Set(req.me.siteIds || []);
        const badAdd = addSites.find(s => !editorSet.has(String(s)));
        const badRem = removeSites.find(s => !editorSet.has(String(s)));
        if (badAdd || badRem) return res.status(403).json({ error: 'Cannot change membership for a site you do not belong to' });
      }

      const data = {};
      if (firstName != null) data.firstName = String(firstName).trim();
      if (lastName  != null) data.lastName  = String(lastName).trim();
      if (email     != null) data.email     = String(email).trim();
      if (typeof isActive === 'boolean') data.isActive = target.passwordHash ? !!isActive : false;

      const currentPrimaryId = target.primarySiteId || null;

      if (role) {
        const roleUp = String(role).toUpperCase();
        if (!['ADMIN','OWNER','MANAGER','USER'].includes(roleUp)) {
          return res.status(400).json({ error: 'Invalid role' });
        }
        const effectivePrimaryForQuota = primarySiteId ? String(primarySiteId) : currentPrimaryId;
        if (roleUp !== (target.role?.name || 'USER') && effectivePrimaryForQuota) {
          const sInfo = await getSettingForSite(effectivePrimaryForQuota);
          if (sInfo) await enforceRoleQuotaOrThrow(sInfo.settingId, roleUp);
        }
        data.role = { connect: { name: roleUp } };
      }

      let ensureMembershipForPrimary = null;
      if (primarySiteId !== undefined) {
        const ps = primarySiteId ? String(primarySiteId) : null;
        if (ps === null) {
          data.primarySite = { disconnect: true };
        } else {
          data.primarySite = { connect: { id: ps } };
        }
        const currentSetPS = new Set(target.memberships.map(m => m.siteId));
        if (ps && !currentSetPS.has(ps)) ensureMembershipForPrimary = ps;
      }

      if (teamId === null || teamId === '') {
        data.team = { disconnect: true };
      } else if (teamId) {
        const siteForTeam = (data.primarySite?.connect?.id ?? currentPrimaryId);
        if (!siteForTeam) return res.status(400).json({ error: 'Select a primarySite before assigning a team' });
        const team = await prisma.coreTeam.findFirst({
          where: { id: String(teamId), siteId: siteForTeam },
          select: { id: true },
        });
        if (!team) return res.status(400).json({ error: 'Team does not belong to primary site' });
        data.team = { connect: { id: String(teamId) } };
      }

      const currentSet = new Set(target.memberships.map(m => m.siteId));
      const toAdd = (addSites || []).map(String).filter(s => !currentSet.has(s));
      const toRemove = (removeSites || []).map(String).filter(s => currentSet.has(s));

      const effectivePrimary = data.primarySite?.connect?.id ?? currentPrimaryId;
      if (effectivePrimary && toRemove.includes(effectivePrimary)) {
        return res.status(400).json({ error: 'Cannot remove membership of primary site' });
      }
      if (ensureMembershipForPrimary && !toAdd.includes(ensureMembershipForPrimary)) {
        toAdd.push(ensureMembershipForPrimary);
      }

      const tx = [];
      tx.push(prisma.coreUser.update({ where: { id }, data }));
      for (const s of toAdd) {
        tx.push(prisma.coreSiteMember.create({ data: { siteId: s, userId: id, isManager: false } }));
      }
      if (toRemove.length) {
        tx.push(prisma.coreSiteMember.deleteMany({ where: { userId: id, siteId: { in: toRemove } } }));
      }

      await prisma.$transaction(tx);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// ------------------------------- Deletion ---------------------------------
r.delete('/users/:id', validate({ params: z.object({ id: z.string().min(1) }) }), async (req, res, next) => {
  try {
    const me = req.me;
    const id = String(req.params.id);
    if (me.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });

    const target = await prisma.coreUser.findUnique({
      where: { id },
      include: {
        role: true,
        memberships: { select: { siteId: true } },
        managedTeams: { select: { id: true } },
      },
    });
    if (!target) return res.status(404).json({ error: 'Not found' });

    const targetRole = target.role?.name || 'USER';
    if (isOwner(me) && targetRole === 'ADMIN') return res.status(403).json({ error: 'Owner cannot delete ADMIN' });
    if (isManager(me)) {
      if (targetRole !== 'USER') return res.status(403).json({ error: 'Manager can only delete USER' });
      const share = target.memberships.some(m => (req.me.siteIds || []).includes(m.siteId));
      if (!share) return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.$transaction(async (tx) => {
      if (target.managedTeams?.length) {
        await tx.coreTeam.updateMany({ where: { managerId: id }, data: { managerId: null } });
      }
      await tx.coreUser.update({ where: { id }, data: { teamId: null, primarySiteId: null } });
      await tx.coreAuthToken.deleteMany({ where: { userId: id } });
      await tx.coreSiteMember.deleteMany({ where: { userId: id } });
      await tx.coreUser.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) { next(e); }
});

// ------------------------------- Resend invite ----------------------------
const mailLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_MAIL_WINDOW_MS || 60 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAIL_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
});

r.post('/users/:id/resend-invite', mailLimiter, validate({ params: z.object({ id: z.string().min(1) }) }), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const u = await prisma.coreUser.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, passwordHash: true, primarySiteId: true },
    });
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.passwordHash) return res.status(400).json({ error: 'User already activated' });
    if (!u.email) return res.status(400).json({ error: 'User has no email' });

    await prisma.coreAuthToken.deleteMany({ where: { userId: u.id, type: CoreAuthTokenType.INVITE, usedAt: null } });

    const raw = makeRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = addMs(new Date(), 48 * 60 * 60 * 1000);

    await prisma.coreAuthToken.create({
      data: { type: CoreAuthTokenType.INVITE, userId: u.id, tokenHash, expiresAt, meta: { siteId: u.primarySiteId || null } },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/set-password?token=${raw}`;
    const html = `
      <p>Bonjour ${u.firstName || ''},</p>
      <p>Voici un nouveau lien pour activer votre compte :</p>
      <p><a href="${link}">${link}</a></p>
      <p>Ce lien expire dans 48 heures.</p>
    `;
    await sendMail(u.email, 'Votre lien d’activation', html, { reason: 'resend-invite' });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = r;
