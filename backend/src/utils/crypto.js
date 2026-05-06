// AES-256-GCM шифрование для IMAP-кредов в БД.
// Ключ — 32 байта в hex, читается из process.env.IMAP_ENCRYPTION_KEY.

const crypto = require('crypto');

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const hex = process.env.IMAP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('IMAP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate via: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

function encrypt(plain) {
  if (typeof plain !== 'string') throw new TypeError('encrypt() expects string');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(packed) {
  if (typeof packed !== 'string' || !packed) throw new TypeError('decrypt() expects non-empty string');
  const buf = Buffer.from(packed, 'base64');
  if (buf.length < 28) throw new Error('decrypt(): payload too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
