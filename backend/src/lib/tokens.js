// src/lib/tokens.js
const crypto = require('crypto');

function makeRawToken() {
  // token URL-safe (64 chars env.) ; tu peux augmenter si tu veux
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function addMs(date, ms) {
  return new Date(date.getTime() + ms);
}

module.exports = { makeRawToken, hashToken, addMs };
