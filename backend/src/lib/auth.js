const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const ACCESS_SECRET  = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const hash = (pwd) => bcrypt.hash(pwd, 12);
const compare = (pwd, hashv) => bcrypt.compare(pwd, hashv);

// ⚠️ Ne pas inclure le rôle complet : soit rien, soit roleId.
// Comme on recharge l'utilisateur + son rôle en DB dans requireAuth, on peut rester minimal.
function signAccess(user) {
  return jwt.sign(
    { sub: user.id, siteId: user.siteId, tv: user.tokenVersion }, // + éventuellement roleId: user.roleId
    ACCESS_SECRET,
    { expiresIn: '12h' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id, tv: user.tokenVersion },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

module.exports = { hash, compare, signAccess, signRefresh, verifyAccess };
