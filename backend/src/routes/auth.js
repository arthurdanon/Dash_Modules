const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { compare, signAccess, signRefresh } = require('../lib/auth');

const prisma = new PrismaClient();
const r = Router();

// POST http://localhost:4000/api/auth/login
r.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    // Charger l'utilisateur avec role + site
    const u = await prisma.user.findUnique({
      where: { username },
      include: { role: true, site: true },
    });
    if (!u || !u.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Tokens (12h / 7j)
    const accessToken = signAccess(u);
    const refreshToken = signRefresh(u);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: u.id,
        username: u.username,
        siteId: u.siteId,
        siteName: u.site?.name || null,   // ✅ défini
        roleName: u.role?.name ?? 'UNKNOWN',
        isAdmin: !!u.role?.isAdmin,
        isManager: !!u.role?.isManager,
        mustChangePwd: u.mustChangePwd,
      },
    });
  } catch (e) {
    console.error('LOGIN ERR', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = r;
