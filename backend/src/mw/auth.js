// src/mw/auth.js
const { PrismaClient } = require('@prisma/client');
const { verifyAccess } = require('../lib/auth');

const prisma = new PrismaClient();

/**
 * requireAuth
 * - Lit le Bearer token
 * - Vérifie la signature
 * - Recharge l'utilisateur (role enum + siteId) pour s'assurer qu'il est actif
 * - Expose req.me avec des flags pratiques
 */
async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const token = hdr.split(' ')[1];
    // Idéalement ton token contient déjà { sub, role, siteId }
    const payload = verifyAccess(token); // { sub, role?, siteId? }
    if (!payload?.sub) return res.status(401).json({ error: 'Invalid token' });

    // Recharge l'utilisateur pour vérifier isActive et récupérer role/siteId au cas où
    const meDb = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: {
        id: true,
        isActive: true,
        role: true,     // enum string: "ADMIN" | "OWNER" | "MANAGER" | "USER"
        siteId: true,   // string | null
      },
    });

    if (!meDb || !meDb.isActive) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    // Construit l'objet req.me uniforme
    const role = meDb.role || payload.role || 'USER';
    req.user = payload; // si tu en as besoin ailleurs
    req.me = {
      id: meDb.id,
      role,                         // string
      siteId: meDb.siteId || payload.siteId || null,
      isAdmin: role === 'ADMIN',
      isManager: role === 'MANAGER',
    };

    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * requireRoleName('ADMIN', 'MANAGER', ...)
 * - Autorise si le rôle de l'utilisateur est dans la liste
 */
function requireRoleName(...names) {
  const allowed = names.map(String).map((n) => n.toUpperCase());
  return (req, res, next) => {
    const me = req.me;
    if (!me) return res.status(401).json({ error: 'No user' });
    if (!allowed.includes(String(me.role).toUpperCase())) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * requireAdmin
 */
function requireAdmin(req, res, next) {
  if (req?.me?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

/**
 * requireManager
 * - Autorise MANAGER et ADMIN
 */
function requireManager(req, res, next) {
  const role = req?.me?.role;
  if (!(role === 'MANAGER' || role === 'ADMIN')) {
    return res.status(403).json({ error: 'Manager/Admin only' });
  }
  next();
}

/**
 * scopedToSite
 * - Si pas ADMIN, exige que l'action cible le même site que celui de l'utilisateur
 * - Vérifie siteId dans params/body/query (string)
 */
function scopedToSite(req, res, next) {
  const me = req.me;
  if (!me) return res.status(401).json({ error: 'No user' });

  // Admin : pas de restriction de site
  if (me.role === 'ADMIN') return next();

  const target =
    (req.params && req.params.siteId) ||
    (req.body && req.body.siteId) ||
    (req.query && req.query.siteId) ||
    null;

  const targetId = target ? String(target) : null;
  const mySiteId = me.siteId ? String(me.siteId) : null;

  if (!targetId || !mySiteId || targetId !== mySiteId) {
    return res.status(403).json({ error: 'Wrong site scope' });
  }

  next();
}

module.exports = { requireAuth, requireRoleName, requireAdmin, requireManager, scopedToSite };
