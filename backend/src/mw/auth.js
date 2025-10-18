const { PrismaClient } = require('@prisma/client');
const { verifyAccess } = require('../lib/auth');
const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).json({ error: 'No token' });
  try {
    const payload = verifyAccess(hdr.split(' ')[1]); // { sub, roleId? ... -> on n'a plus role direct }
    req.user = payload;
    // enrichir avec le role (flags)
    const me = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true }
    });
    if (!me || !me.isActive) return res.status(401).json({ error: 'Invalid user' });
    req.me = me; // { id, siteId, role: { name, isAdmin, isManager } ...}
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// rolesAllowed: ["ADMIN"] etc. (par nom)
function requireRoleName(...names) {
  return (req, res, next) => {
    const me = req.me;
    if (!me) return res.status(401).json({ error: 'No user' });
    if (!names.includes(me.role.name)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.me?.role?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

function requireManager(req, res, next) {
  if (!req.me?.role?.isManager && !req.me?.role?.isAdmin) return res.status(403).json({ error: 'Manager/Admin only' });
  next();
}

function scopedToSite(req, res, next) {
  const me = req.me;
  const siteId = req.params.siteId || req.body.siteId || req.query.siteId;
  if (!me.role.isAdmin) {
    if (!siteId || siteId !== me.siteId) return res.status(403).json({ error: 'Wrong site scope' });
  }
  next();
}

module.exports = { requireAuth, requireRoleName, requireAdmin, requireManager, scopedToSite };
