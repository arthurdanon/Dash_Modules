// backend/src/lib/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Secrets & TTL
const ACCESS_SECRET  = process.env.ACCESS_SECRET  || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET;
const ACCESS_TTL     = process.env.JWT_ACCESS_TTL  || '12h';
const REFRESH_TTL    = process.env.JWT_REFRESH_TTL || '7d';

// Issuer / Audience (optionnel mais recommandé)
const ISSUER   = process.env.JWT_ISSUER   || 'taskflow-core';
const AUDIENCE = process.env.JWT_AUDIENCE || 'taskflow-clients';

// Alerte de config manquante (ne crash pas en dev)
if (!ACCESS_SECRET || !REFRESH_SECRET) {
  console.warn('[auth] Missing ACCESS_SECRET and/or REFRESH_SECRET — set them in .env');
}

// BCrypt helpers
const hash = (pwd) => bcrypt.hash(pwd, 12);
const compare = (pwd, hashv) => bcrypt.compare(pwd, hashv);

/**
 * Access token
 * - inclut le minimum nécessaire pour les modules/fronts :
 *   sub (userId), username, role (enum), siteId, ver (tokenVersion)
 * - compat: expose aussi "tv" = ver
 */
function signAccess(user) {
  const payload = {
    sub: String(user.id),
    username: String(user.username),
    role: String(user.role || 'USER'),             // 'ADMIN' | 'OWNER' | 'MANAGER' | 'USER'
    siteId: user.siteId ? String(user.siteId) : null,
    ver: Number(user.tokenVersion ?? 0),
    tv:  Number(user.tokenVersion ?? 0),           // compat
    typ: 'access',
  };
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * Refresh token
 * - typé "refresh"
 * - contient sub + ver (tokenVersion) pour invalider après reset/rotation
 */
function signRefresh(user) {
  const payload = {
    sub: String(user.id),
    ver: Number(user.tokenVersion ?? 0),
    typ: 'refresh',
  };
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

// Vérifs
function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: ISSUER, audience: AUDIENCE });
}

function verifyRefresh(token) {
  const p = jwt.verify(token, REFRESH_SECRET, { issuer: ISSUER, audience: AUDIENCE });
  if (p.typ !== 'refresh') throw new Error('Bad token type');
  return p;
}

module.exports = {
  hash,
  compare,
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
};
