const AUTH_CACHE_TTL = 15 * 60 * 1000; // 15 минут
const cache = new Map();

function get(userId) {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > AUTH_CACHE_TTL) {
    cache.delete(userId);
    return null;
  }
  return entry.data;
}

function set(userId, data) {
  cache.set(userId, { data, ts: Date.now() });
}

function invalidate(userId) {
  cache.delete(userId);
}

function invalidateAll() {
  cache.clear();
}

module.exports = { get, set, invalidate, invalidateAll };
