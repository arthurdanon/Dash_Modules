const crypto = require('crypto');

const keyB64 = process.env.PASSWORD_ENC_KEY;
if (!keyB64) throw new Error('PASSWORD_ENC_KEY missing');
const key = Buffer.from(keyB64, 'base64'); // 32 bytes

function encryptPassword(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { enc, iv, tag };
}

function decryptPassword(enc, iv, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encryptPassword, decryptPassword };