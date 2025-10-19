// src/routes/auth.js
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { compare, signAccess, signRefresh } = require('../lib/auth');

const prisma = new PrismaClient();
const r = Router();

// POST http://localhost:4000/api/auth/login
r.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // Récupération de l'utilisateur (role est un enum scalaire désormais)
    const u = await prisma.user.findUnique({
      where: { username },
      include: {
        site: true,        // relations utiles
        team: true,        // (optionnel) si tu veux l'envoyer au front
        managedSite: true, // (optionnel)
      },
    });

    if (!u || !u.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await compare(password, u.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Tokens (garde la même signature que tes helpers actuels)
    const accessToken = signAccess(u);
    const refreshToken = signRefresh(u);

    // role est une string/enum: "ADMIN" | "OWNER" | "MANAGER" | "USER"
    const role = u.role || 'UNKNOWN';
    const isAdmin = role === 'ADMIN';
    const isManager = role === 'MANAGER';

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role,                   // <- string
        isAdmin,
        isManager,
        siteId: u.siteId || null,
        siteName: u.site?.name ?? null,
        team: u.team ? { id: u.team.id, name: u.team.name } : null,
        managedSite: u.managedSite ? { id: u.managedSite.id, name: u.managedSite.name } : null,
        mustChangePwd: u.mustChangePwd,
      },
    });
  } catch (e) {
    console.error('LOGIN ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = r;
