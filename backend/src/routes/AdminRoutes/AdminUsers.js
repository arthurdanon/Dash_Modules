// backend/src/routes/AdminRoutes/AdminUsers.js
const { Router } = require('express');
const { PrismaClient, CoreAuthTokenType } = require('@prisma/client');
const { requireAuth, requireManager, scopedToSite } = require('../../mw/auth');
const { sendMail } = require('../../lib/mailer');
const { makeRawToken, hashToken, addMs } = require('../../lib/tokens');

const prisma = new PrismaClient();
const r = Router();

// Tout /api/admin/users* => ADMIN/OWNER/MANAGER authentifiés
r.use(requireAuth, requireManager);

/* ============================== Helpers rôles ============================== */

const ROLES = { ADMIN: 'ADMIN', OWNER: 'OWNER', MANAGER: 'MANAGER', USER: 'USER' };

const hasRoleName = (role, name) => String(role || '').toUpperCase() === name;
const hasRole = (me, name) =>
  !!me && (me[`is${name[0]}${name.slice(1).toLowerCase()}`] || hasRoleName(me.role, name));

const isAdmin  = (me) => hasRole(me, ROLES.ADMIN);
const isOwner  = (me) => hasRole(me, ROLES.OWNER);
const isMgr    = (me) => hasRole(me, ROLES.MANAGER);

const isAdminOrOwner = (me) => isAdmin(me) || isOwner(me);

/* ============================ Helpers sélection ============================ */

const BASE_USER_SELECT = {
  id: true, username: true, email: true, firstName: true, lastName: true,
  isActive: true, passwordHash: true,
  team: { select: { id: true, name: true, siteId: true } },
  primarySite: { select: { id: true, name: true } },
  role: { select: { name: true } },
};

const DETAIL_USER_SELECT = {
  id: true, username: true, email: true, firstName: true, lastName: true,
  isActive: true, passwordHash: true,
  primarySite: { select: { id: true } },
  team: { select: { id: true } },
  role: { select: { name: true } },
  memberships: { select: { siteId: true } },
};

const withPasswordsStripped = ({ passwordHash, role, ...u }) => ({
  ...u,
  role: role?.name || ROLES.USER,
  hasPassword: !!passwordHash,
});

/* ============================ Helpers settings ============================ */

async function getAnySettingId() {
  const s = await prisma.coreSetting.findFirst({ select: { id: true } });
  return s?.id || null;
}

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

/** settingId pertinent pour l’acteur. */
async function getSettingIdForActor(me, explicitSettingId) {
  if (explicitSettingId) return String(explicitSettingId);
  if (isAdminOrOwner(me)) return await getAnySettingId();

  if (me.primarySiteId) {
    const s = await prisma.coreSite.findUnique({
      where: { id: me.primarySiteId },
      select: { settingId: true },
    });
    if (s?.settingId) return s.settingId;
  }
  const any = await prisma.coreSiteMember.findFirst({
    where: { userId: me.id },
    select: { site: { select: { settingId: true } } },
  });
  return any?.site?.settingId || null;
}

/* ============================== Helpers quotas ============================ */

/**
 * Comptage par rôle dans un setting:
 * - OWNER: pas de memberships => comptage global par rôle
 * - MANAGER/USER: via memberships reliés à des sites du setting
 */
async function countUsersInSettingByRole(settingId, roleName) {
  const role = String(roleName).toUpperCase();

  if (role === ROLES.OWNER) {
    return prisma.coreUser.count({ where: { role: { name: ROLES.OWNER } } });
  }
  return prisma.coreUser.count({
    where: {
      role: { name: role },
      memberships: { some: { site: { settingId: String(settingId) } } },
    },
  });
}

async function enforceRoleQuotaOrThrow(settingId, roleName) {
  const role = String(roleName).toUpperCase();
  if (![ROLES.OWNER, ROLES.MANAGER, ROLES.USER].includes(role)) return;

  const s = await prisma.coreSetting.findUnique({
    where: { id: String(settingId) },
    select: { maxOwners: true, maxManagers: true, maxUsers: true },
  });
  if (!s) return;

  const limit =
    role === ROLES.OWNER   ? s.maxOwners :
    role === ROLES.MANAGER ? s.maxManagers :
    role === ROLES.USER    ? s.maxUsers :
    null;

  if (limit == null) return;

  const current = await countUsersInSettingByRole(settingId, role);
  if (current >= limit) {
    const label = role === ROLES.OWNER ? 'Owner' : role === ROLES.MANAGER ? 'Manager' : 'User';
    const err = new Error(`${label} quota reached`);
    err.status = 403;
    throw err;
  }
}

async function isUserAlreadyCountedInSetting(userId, settingId) {
  const m = await prisma.coreSiteMember.findFirst({
    where: { userId: String(userId), site: { settingId: String(settingId) } },
    select: { id: true },
  });
  return !!m;
}

/* ============================ Helpers permissions ========================= */

function assertCanCreate(me, targetRole) {
  const up = String(targetRole).toUpperCase();
  if (!Object.values(ROLES).includes(up)) {
    const e = new Error('Invalid role'); e.status = 400; throw e;
  }
  if (isAdmin(me)) return; // ADMIN => OK
  if (isOwner(me)) {
    if (up === ROLES.ADMIN) { const e = new Error('Only ADMIN can create ADMIN'); e.status = 403; throw e; }
    return;
  }
  if (isMgr(me)) {
    if (up !== ROLES.USER) { const e = new Error('Manager can only create USER'); e.status = 403; throw e; }
    return;
  }
  const e = new Error('Forbidden'); e.status = 403; throw e;
}

function assertCanSeeUser(me, targetRole) {
  if (isAdmin(me)) return;
  if (String(targetRole).toUpperCase() === ROLES.ADMIN) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }
}

function canManagerTouchTarget(me, targetMembershipSiteIds) {
  const editorSites = new Set(me.siteIds || []);
  return targetMembershipSiteIds.some(id => editorSites.has(id));
}

function assertCanDelete(me, targetRole, targetMembershipSiteIds) {
  const r = String(targetRole).toUpperCase();
  if (isAdmin(me)) return;

  if (isOwner(me)) {
    if (r === ROLES.ADMIN) { const e = new Error('Owner cannot delete ADMIN'); e.status = 403; throw e; }
    return;
  }

  if (isMgr(me)) {
    if (r !== ROLES.USER) { const e = new Error('Manager can only delete USER'); e.status = 403; throw e; }
    if (!canManagerTouchTarget(me, targetMembershipSiteIds)) {
      const e = new Error('Forbidden'); e.status = 403; throw e;
    }
    return;
  }

  const e = new Error('Forbidden'); e.status = 403; throw e;
}

function assertCanEdit(me, targetRole, targetMembershipSiteIds, nextRole) {
  // Partage de site obligatoire pour OWNER/MANAGER
  if (!isAdmin(me)) {
    if (!canManagerTouchTarget(me, targetMembershipSiteIds)) {
      const e = new Error('Forbidden'); e.status = 403; throw e;
    }
    if (isOwner(me) && nextRole && String(nextRole).toUpperCase() === ROLES.ADMIN) {
      const e = new Error('Owner cannot set ADMIN'); e.status = 403; throw e;
    }
    if (isMgr(me) && nextRole && String(nextRole).toUpperCase() !== ROLES.USER) {
      const e = new Error('Manager can only set USER'); e.status = 403; throw e;
    }
  }
}

/* ================================ ROUTES ================================= */

/** Stats (OWNER = global, MANAGER/USER = via membership du setting) */
r.get('/users/stats', async (req, res, next) => {
  try {
    const me = req.me;
    const settingId = await getSettingIdForActor(me, req.query.settingId);
    if (!settingId) return res.status(404).json({ error: 'No setting context' });

    const s = await prisma.coreSetting.findUnique({
      where: { id: settingId },
      select: { maxOwners: true, maxManagers: true, maxUsers: true },
    });
    if (!s) return res.status(404).json({ error: 'Setting not found' });

    const [owners, managers, users] = await Promise.all([
      countUsersInSettingByRole(settingId, ROLES.OWNER),
      countUsersInSettingByRole(settingId, ROLES.MANAGER),
      countUsersInSettingByRole(settingId, ROLES.USER),
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

/** Création (quotas) — OWNER/ADMIN: aucun site/équipe attribué à la création */
r.post('/sites/:siteId/users', scopedToSite, async (req, res, next) => {
  try {
    const me = req.me;
    const siteId = String(req.params.siteId);
    const { role, firstName, lastName, username, email, teamId } = req.body || {};

    if (!firstName?.trim() || !lastName?.trim() || !username?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Missing fields (firstName, lastName, username, email)' });
    }
    const roleUp = String(role || ROLES.USER).toUpperCase();
    assertCanCreate(me, roleUp);

    const settingInfo = await getSettingForSite(siteId);
    if (!settingInfo) return res.status(404).json({ error: 'Site not found' });
    await enforceRoleQuotaOrThrow(settingInfo.settingId, roleUp);

    const data = {
      username: username.trim(),
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      isActive: false,
      mustChangePwd: true,
      role: { connect: { name: roleUp } },
    };

    if (roleUp === ROLES.OWNER || roleUp === ROLES.ADMIN) {
      // Pas de rattachement site/équipe
    } else {
      // MANAGER/USER => primarySite + membership (+ team si valide)
      data.primarySite = { connect: { id: siteId } };
      data.memberships = { create: { siteId, isManager: roleUp === ROLES.MANAGER } };
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
      data: {
        type: CoreAuthTokenType.INVITE,
        userId: created.id,
        tokenHash,
        expiresAt,
        meta: { siteId },
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/set-password?token=${raw}`;
    const html = `
      <p>Bonjour ${created.firstName},</p>
      <p>Un compte a été créé pour vous sur Taskflow. Pour définir votre mot de passe, cliquez sur le lien :</p>
      <p><a href="${link}">${link}</a></p>
      <p>Ce lien expire dans 48 heures.</p>
    `;
    await sendMail(created.email, 'Activez votre compte Taskflow', html, { reason: 'invite' });

    res.status(201).json({ user: created, invitationSent: true });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === 'P2002') {
      const target = e?.meta?.target?.join(', ') || 'unique';
      return res.status(409).json({ error: `Unique constraint violation on ${target}` });
    }
    next(e);
  }
});

/** LISTE — ADMIN voit tout; OWNER/MANAGER ne voient pas les ADMIN (MANAGER limité à ses sites) */
r.get('/users', async (req, res, next) => {
  try {
    const me = req.me;

    let where = {};
    if (isAdmin(me)) {
      // no filter
    } else if (isOwner(me)) {
      where = { role: { name: { not: ROLES.ADMIN } } };
    } else {
      where = {
        memberships: { some: { siteId: { in: req.me.siteIds || [] } } },
        role: { name: { not: ROLES.ADMIN } },
      };
    }

    const users = await prisma.coreUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: BASE_USER_SELECT,
    });

    res.json(users.map(withPasswordsStripped));
  } catch (e) { next(e); }
});

/** Détails (lecture) — non-ADMIN ne peut pas consulter un ADMIN */
r.get('/users/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const u = await prisma.coreUser.findUnique({
      where: { id },
      select: {
        ...BASE_USER_SELECT,
        memberships: { select: { siteId: true, isManager: true, site: { select: { name: true } } } },
      },
    });
    if (!u) return res.status(404).json({ error: 'Not found' });

    assertCanSeeUser(req.me, u.role?.name);

    res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      hasPassword: !!u.passwordHash,
      role: u.role?.name || ROLES.USER,
      primarySite: u.primarySite || null,
      team: u.team || null,
      primarySiteId: u.primarySite?.id || null,
      teamId: u.team?.id || null,
      memberships: (u.memberships || []).map(m => ({
        siteId: m.siteId,
        siteName: m.site?.name || m.siteId,
        isManager: m.isManager,
      })),
    });
  } catch (e) { next(e); }
});

/** Détail pour modale — non-ADMIN ne peut pas consulter un ADMIN */
r.get('/users/:id/detail', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const u = await prisma.coreUser.findUnique({ where: { id }, select: DETAIL_USER_SELECT });
    if (!u) return res.status(404).json({ error: 'Not found' });

    assertCanSeeUser(req.me, u.role?.name);

    const membershipSiteIds = (u.memberships || []).map(m => m.siteId);
    res.json({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        hasPassword: !!u.passwordHash,
        primarySiteId: u.primarySite?.id || '',
        teamId: u.team?.id || '',
        role: { name: u.role?.name || ROLES.USER },
      },
      membershipSiteIds,
    });
  } catch (e) { next(e); }
});

/** Ajout d’appartenance (quotas si nécessaire) */
r.post('/users/:id/memberships', async (req, res, next) => {
  try {
    const userId = String(req.params.id);
    const { siteId } = req.body || {};
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const u = await prisma.coreUser.findUnique({
      where: { id: userId },
      select: { id: true, role: { select: { name: true } } },
    });
    if (!u) return res.status(404).json({ error: 'User not found' });

    const sInfo = await getSettingForSite(siteId);
    if (!sInfo) return res.status(404).json({ error: 'Site not found' });

    const roleName = u.role?.name || ROLES.USER;
    if ([ROLES.OWNER, ROLES.MANAGER, ROLES.USER].includes(roleName)) {
      const alreadyCounted = await isUserAlreadyCountedInSetting(userId, sInfo.settingId);
      if (!alreadyCounted) await enforceRoleQuotaOrThrow(sInfo.settingId, roleName);
    }

    await prisma.coreSiteMember.create({ data: { siteId: String(siteId), userId, isManager: false } });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Already member of this site' });
    next(e);
  }
});

/** Suppression */
r.delete('/users/:id', async (req, res, next) => {
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

    const targetRole = target.role?.name || ROLES.USER;
    const targetMembershipSiteIds = (target.memberships || []).map(m => m.siteId);

    assertCanDelete(me, targetRole, targetMembershipSiteIds);

    await prisma.$transaction(async (tx) => {
      if (target.managedTeams?.length) {
        await tx.coreTeam.updateMany({ where: { managerId: id }, data: { managerId: null } });
      }
      await tx.coreUser.update({
        where: { id },
        data: {
          team: { disconnect: true },
          primarySite: { disconnect: true },
        },
      });
      await tx.coreAuthToken.deleteMany({ where: { userId: id } });
      await tx.coreSiteMember.deleteMany({ where: { userId: id } });
      await tx.coreUser.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) { next(e); }
});

/** Édition (règles + quotas lors de changement de rôle / site) */
r.patch('/users/:id', async (req, res, next) => {
  try {
    const me = req.me;
    const id = String(req.params.id);
    const {
      firstName, lastName, email, role, isActive,
      primarySiteId, teamId,
      addSites = [], removeSites = [],
    } = req.body || {};

    const target = await prisma.coreUser.findUnique({
      where: { id },
      select: {
        id: true,
        passwordHash: true,
        primarySite: { select: { id: true } },
        role: { select: { name: true } },
        memberships: { select: { siteId: true, site: { select: { settingId: true } } } },
      },
    });
    if (!target) return res.status(404).json({ error: 'Not found' });

    const targetMembershipSiteIds = target.memberships.map(m => m.siteId);
    assertCanEdit(me, target.role?.name, targetMembershipSiteIds, role);

    // Bouclier "édition de memberships hors scope" pour OWNER/MANAGER
    if (!isAdmin(me)) {
      const editorSet = new Set(me.siteIds || []);
      const badAdd = addSites.find(s => !editorSet.has(String(s)));
      const badRem = removeSites.find(s => !editorSet.has(String(s)));
      if (badAdd || badRem) return res.status(403).json({ error: 'Cannot change membership for a site you do not belong to' });
    }

    const data = {};
    if (firstName != null) data.firstName = String(firstName).trim();
    if (lastName  != null) data.lastName  = String(lastName).trim();
    if (email     != null) data.email     = String(email).trim();
    if (typeof isActive === 'boolean') {
      data.isActive = target.passwordHash ? !!isActive : false;
    }

    const currentPrimaryId = target.primarySite?.id || null;

    // Rôle + quotas
    if (role) {
      const roleUp = String(role).toUpperCase();
      if (!Object.values(ROLES).includes(roleUp)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const effectivePrimaryForQuota = primarySiteId ? String(primarySiteId) : currentPrimaryId;

      if (roleUp !== (target.role?.name || ROLES.USER)) {
        if (roleUp === ROLES.OWNER && !effectivePrimaryForQuota) {
          // OWNER sans site principal => quota via setting "global"
          const fallbackSettingId = await getSettingIdForActor(me, null);
          if (fallbackSettingId) await enforceRoleQuotaOrThrow(fallbackSettingId, roleUp);
        } else if (effectivePrimaryForQuota) {
          const sInfo = await getSettingForSite(effectivePrimaryForQuota);
          if (sInfo) await enforceRoleQuotaOrThrow(sInfo.settingId, roleUp);
        }
      }
      data.role = { connect: { name: roleUp } };
    }

    // Primary site
    let ensureMembershipForPrimary = null;
    if (primarySiteId !== undefined) {
      const ps = primarySiteId ? String(primarySiteId) : null;
      if (ps === null) data.primarySite = { disconnect: true };
      else data.primarySite = { connect: { id: ps } };

      const currentSetPS = new Set(target.memberships.map(m => m.siteId));
      if (ps && !currentSetPS.has(ps)) ensureMembershipForPrimary = ps;
    }

    // Team (doit appartenir au site principal effectif)
    if (teamId === null || teamId === '') {
      data.team = { disconnect: true };
    } else if (teamId) {
      const siteForTeam =
        (data.primarySite?.connect?.id ?? currentPrimaryId) || null;
      if (!siteForTeam) return res.status(400).json({ error: 'Select a primarySite before assigning a team' });
      const team = await prisma.coreTeam.findFirst({
        where: { id: String(teamId), siteId: siteForTeam },
        select: { id: true },
      });
      if (!team) return res.status(400).json({ error: 'Team does not belong to primary site' });
      data.team = { connect: { id: String(teamId) } };
    }

    // Memberships add/remove
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

    // Transaction
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
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    next(e);
  }
});

/** Resend invite */
r.post('/users/:id/resend-invite', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const u = await prisma.coreUser.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, passwordHash: true, primarySiteId: true },
    });
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.passwordHash) return res.status(400).json({ error: 'User already activated' });
    if (!u.email) return res.status(400).json({ error: 'User has no email' });

    await prisma.coreAuthToken.deleteMany({
      where: { userId: u.id, type: CoreAuthTokenType.INVITE, usedAt: null },
    });

    const raw = makeRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = addMs(new Date(), 48 * 60 * 60 * 1000);

    await prisma.coreAuthToken.create({
      data: {
        type: CoreAuthTokenType.INVITE,
        userId: u.id,
        tokenHash,
        expiresAt,
        meta: { siteId: u.primarySiteId || null },
      },
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
