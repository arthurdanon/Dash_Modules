// backend/src/routes/auth.js
const { Router } = require('express');
const { PrismaClient, CoreAuthTokenType } = require('@prisma/client');
const { compare, hash, signAccess, signRefresh } = require('../lib/auth');
const { sendMail } = require('../lib/mailer');
const { addMs, hashToken, makeRawToken } = require('../lib/tokens');

const prisma = new PrismaClient();
const r = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Compat transition: si l'email ne matche pas, on tente username == emailOrUsername.
 */
r.post('/login', async (req, res) => {
  try {
    const emailOrUsername = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // On autorise email OU username pendant la transition
    const u = await prisma.coreUser.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      include: {
        role: true,        // CoreRole { name, isAdmin, isOwner, isManager }
        primarySite: true, // CoreSite (optionnel)
      },
    });

    // interdit si inactif ou si pas de mot de passe défini (compte invité non activé)
    if (!u || !u.isActive || !u.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Tokens
    const accessToken = signAccess({
      id: u.id,
      username: u.username || u.email || emailOrUsername,
      role: u.role?.name || 'USER',
      siteId: u.primarySiteId || null,
      tokenVersion: u.tokenVersion ?? 0,
    });
    const refreshToken = signRefresh({
      id: u.id,
      tokenVersion: u.tokenVersion ?? 0,
    });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role?.name || 'USER',
        isAdmin: !!u.role?.isAdmin,
        isOwner: !!u.role?.isOwner,
        isManager: !!u.role?.isManager,
        siteId: u.primarySiteId || null,
        siteName: u.primarySite?.name || null,
        mustChangePwd: !!u.mustChangePwd,
      },
    });
  } catch (e) {
    console.error('LOGIN ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/accept-invite
 * Body: { token, password }
 * - Définit le mot de passe
 * - Marque le compte actif (isActive: true)
 * - Invalide le token (usedAt)
 */
r.post('/accept-invite', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Missing token/password' });

    const tokenHash = hashToken(token);
    const t = await prisma.coreAuthToken.findUnique({ where: { tokenHash } });
    if (!t || t.type !== CoreAuthTokenType.INVITE) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    if (t.usedAt) return res.status(400).json({ error: 'Token already used' });
    if (t.expiresAt < new Date()) return res.status(400).json({ error: 'Token expired' });

    const passwordHash = await hash(password);

    await prisma.$transaction([
      prisma.coreUser.update({
        where: { id: t.userId },
        data: {
          passwordHash,
          mustChangePwd: false,
          isActive: true,                   // ⬅️ activation à la définition du mot de passe
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.coreAuthToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    console.error('ACCEPT INVITE ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * (on ne révèle pas si l'email existe)
 * - Seuls les comptes déjà actifs peuvent recevoir un reset.
 */
r.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'Provide email' });

    const u = await prisma.coreUser.findUnique({ where: { email } });

    // Toujours renvoyer 200 pour ne pas révéler l’existence du compte
    if (!u || !u.isActive) return res.json({ ok: true });

    // Optionnel: invalider les anciens tokens RESET non utilisés
    await prisma.coreAuthToken.deleteMany({
      where: { userId: u.id, type: CoreAuthTokenType.RESET, usedAt: null },
    });

    const raw = makeRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = addMs(new Date(), 60 * 60 * 1000); // 1h

    await prisma.coreAuthToken.create({
      data: {
        type: CoreAuthTokenType.RESET,
        userId: u.id,
        tokenHash,
        expiresAt,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/reset-password?token=${raw}`;
    const html = `
      <p>Bonjour ${u.firstName || u.username || u.email},</p>
      <p>Pour réinitialiser votre mot de passe, cliquez sur le lien suivant :</p>
      <p><a href="${link}">${link}</a></p>
      <p>Ce lien est valable 1 heure.</p>
    `;
    if (u.email) {
      await sendMail(u.email, 'Réinitialisation du mot de passe', html, { reason: 'reset' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('FORGOT ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 * - Définit/Met à jour le mot de passe
 * - Marque le compte actif (utile si l’utilisateur n’avait jamais activé)
 * - Invalide le token (usedAt)
 */
r.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Missing token/password' });

    const tokenHash = hashToken(token);
    const t = await prisma.coreAuthToken.findUnique({ where: { tokenHash } });
    if (!t || t.type !== CoreAuthTokenType.RESET) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    if (t.usedAt) return res.status(400).json({ error: 'Token already used' });
    if (t.expiresAt < new Date()) return res.status(400).json({ error: 'Token expired' });

    const passwordHash = await hash(password);

    await prisma.$transaction([
      prisma.coreUser.update({
        where: { id: t.userId },
        data: {
          passwordHash,
          mustChangePwd: false,
          isActive: true,                   // ⬅️ active si ce n’était pas le cas
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.coreAuthToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    console.error('RESET ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = r;
