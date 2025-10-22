// backend/src/mw/auth.js
const { PrismaClient } = require('@prisma/client');
const { verifyAccess } = require('../lib/auth');

const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || req.headers.Authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = verifyAccess(hdr.slice(7).trim()); // { sub, username, role?, siteId?, ver/tv }
    if (!payload?.sub) return res.status(401).json({ error: 'Invalid token' });

    const meDb = await prisma.coreUser.findUnique({
      where: { id: String(payload.sub) },
      select: {
        id: true, username: true, isActive: true, tokenVersion: true,
        primarySiteId: true,
        role: { select: { name: true, isAdmin: true, isOwner: true, isManager: true } },
        memberships: { select: { siteId: true } },
      },
    });
    if (!meDb || !meDb.isActive) return res.status(401).json({ error: 'Invalid user' });

    const tokenVer = (payload.ver ?? payload.tv ?? 0) | 0;
    if (tokenVer !== (meDb.tokenVersion ?? 0)) return res.status(401).json({ error: 'Invalid token' });

    const siteIds = meDb.memberships.map(m => m.siteId);
    const roleName = meDb.role?.name || 'USER';

    req.user = payload;
    req.me = {
      id: meDb.id,
      username: meDb.username,
      role: roleName,
      isAdmin: !!meDb.role?.isAdmin,
      isOwner: !!meDb.role?.isOwner,
      isManager: !!meDb.role?.isManager,
      primarySiteId: meDb.primarySiteId || null,
      siteIds, // multi-sites accessibles
      tokenVersion: meDb.tokenVersion,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRoleName(...names) {
  const allowed = names.map(n => String(n).toUpperCase());
  return (req, res, next) => {
    if (!req.me) return res.status(401).json({ error: 'No user' });
    if (!allowed.includes(String(req.me.role).toUpperCase())) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.me?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

/** OWNER/MANAGER/ADMIN */
function requireManager(req, res, next) {
  if (req.me?.isAdmin || req.me?.isOwner || req.me?.isManager) return next();
  return res.status(403).json({ error: 'Manager/Owner/Admin only' });
}

/** Si pas ADMIN, exige membership au site ciblé */
function scopedToSite(req, res, next) {
  const me = req.me;
  if (!me) return res.status(401).json({ error: 'No user' });
  // avant: if (me.isAdmin) return next();
  if (me.isAdmin || me.isOwner) return next(); // ✅ owner passe aussi

  const target =
    req.params?.siteId || req.body?.siteId || req.query?.siteId || me.primarySiteId || null;

  if (!target) return res.status(400).json({ error: 'Missing siteId' });
  if (!me.siteIds.includes(String(target))) {
    return res.status(403).json({ error: 'Wrong site scope' });
  }
  next();
}


module.exports = { requireAuth, requireRoleName, requireAdmin, requireManager, scopedToSite };
