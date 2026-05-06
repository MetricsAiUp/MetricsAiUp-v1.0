// SHA-256 от стабильно сериализованного объекта бизнес-полей.
// Используется для дедупликации в OneC* и сводных таблицах.

const crypto = require('crypto');

function stable(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === 'object') {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = stable(value[k]);
    return sorted;
  }
  return value;
}

function contentHash(obj) {
  const json = JSON.stringify(stable(obj));
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = { contentHash };
