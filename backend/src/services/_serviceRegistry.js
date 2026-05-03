/**
 * Lightweight in-memory registry for background service stats.
 *
 * Каждый фоновой сервис при старте вызывает `register(name, meta)`, при каждом
 * успешном тике — `tick(name)`, при ошибке — `error(name, err)`. Health-роут
 * читает агрегат через `getAll()`.
 *
 * Цель — единый формат `{running, lastTickAt, lastError, ticks, errors}` без
 * того чтобы каждый сервис изобретал свои геттеры.
 */

const services = new Map(); // name → { running, registeredAt, lastTickAt, lastError, ticks, errors, meta }

function register(name, meta = {}) {
  const existing = services.get(name);
  services.set(name, {
    running: true,
    registeredAt: existing?.registeredAt || new Date(),
    lastTickAt: existing?.lastTickAt || null,
    lastError: existing?.lastError || null,
    ticks: existing?.ticks || 0,
    errors: existing?.errors || 0,
    meta: { ...(existing?.meta || {}), ...meta },
  });
}

function tick(name, payload = null) {
  const s = services.get(name);
  if (!s) return;
  s.lastTickAt = new Date();
  s.ticks += 1;
  if (payload != null) s.meta.lastPayload = payload;
}

function error(name, err) {
  const s = services.get(name);
  if (!s) return;
  s.errors += 1;
  s.lastError = {
    message: err?.message || String(err),
    at: new Date(),
  };
}

function unregister(name) {
  const s = services.get(name);
  if (s) s.running = false;
}

function getAll() {
  const result = [];
  for (const [name, s] of services.entries()) {
    result.push({
      name,
      running: s.running,
      registeredAt: s.registeredAt?.toISOString() || null,
      lastTickAt: s.lastTickAt?.toISOString() || null,
      lastError: s.lastError
        ? { message: s.lastError.message, at: s.lastError.at?.toISOString() || null }
        : null,
      ticks: s.ticks,
      errors: s.errors,
      meta: s.meta || {},
    });
  }
  return result;
}

function get(name) {
  return services.get(name) || null;
}

function reset() {
  services.clear();
}

module.exports = { register, tick, error, unregister, getAll, get, reset };
