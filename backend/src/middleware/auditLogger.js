const prisma = require('../config/database');
const logger = require('../config/logger');

/**
 * Глобальный аудит-логгер для всех мутирующих эндпоинтов /api/*.
 * Перехватывает res.json, определяет entity по пути и пишет AuditLog
 * fire-and-forget. Чувствительные поля маскируются, большие тела обрезаются.
 *
 * Подключается одним вызовом app.use(auditLogger) перед /api/* роутами.
 */

const METHOD_TO_ACTION = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// Правила сопоставления путей (применяются к req.originalUrl без префикса /api)
// Порядок важен — первое совпадение выигрывает.
const ENTITY_RULES = [
  // auth — спец-действия
  { pattern: /^\/auth\/login$/,    entity: 'auth',     action: 'login',    captureBody: false },
  { pattern: /^\/auth\/logout$/,   entity: 'auth',     action: 'logout',   captureBody: false },
  { pattern: /^\/auth\/register$/, entity: 'user',     action: 'register' },

  // CRUD по сущностям
  { pattern: /^\/zones/,             entity: 'zone' },
  { pattern: /^\/posts/,             entity: 'post' },
  { pattern: /^\/users/,             entity: 'user' },
  { pattern: /^\/cameras/,           entity: 'camera' },
  { pattern: /^\/work-orders-crud/,  entity: 'workOrder' },
  { pattern: /^\/work-orders/,       entity: 'workOrder' },
  { pattern: /^\/sessions/,          entity: 'session' },
  { pattern: /^\/recommendations/,   entity: 'recommendation' },
  { pattern: /^\/shifts/,            entity: 'shift' },
  { pattern: /^\/locations/,         entity: 'location' },
  { pattern: /^\/map-layout/,        entity: 'mapLayout' },
  { pattern: /^\/settings/,          entity: 'settings' },
  { pattern: /^\/report-schedules/,  entity: 'reportSchedule' },
  { pattern: /^\/1c/,                entity: 'data1c' },
  { pattern: /^\/backup/,            entity: 'backup' },
];

// Эти пути логировать НЕ нужно (шум, технические, чтение, тяжёлые тела)
const SKIP_PATTERNS = [
  /^\/audit-log/,         // GET журнала — не пишем
  /^\/auth\/refresh/,     // фоновые refresh, ходят часто
  /^\/auth\/me/,          // GET профиля
  /^\/events(\/|$|\?)/,   // POST от CV без auth
  /^\/push\//,            // подписки на push, технические
  /^\/photos/,            // base64 — тяжёлые тела
  /^\/system-health/,
  /^\/dashboard/,
  /^\/monitoring/,
  /^\/predict/,
  /^\/replay/,
  /^\/workers/,
  /^\/health/,
];

const SENSITIVE_KEY_RE = /^(password|passwd|pwd|token|accessToken|refreshToken|secret|p256dh|auth|privateKey|apiKey)$/i;
const MAX_JSON_LEN = 8000;

function redact(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

function safeStringify(obj) {
  if (obj == null) return null;
  try {
    let s = JSON.stringify(redact(obj));
    if (!s) return null;
    if (s.length > MAX_JSON_LEN) s = s.slice(0, MAX_JSON_LEN) + '...[truncated]';
    return s;
  } catch {
    return null;
  }
}

function matchEntity(apiPath) {
  for (const rule of ENTITY_RULES) {
    if (rule.pattern.test(apiPath)) return rule;
  }
  return null;
}

function shouldSkip(apiPath) {
  return SKIP_PATTERNS.some(p => p.test(apiPath));
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function buildUserName(user) {
  if (!user) return null;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || null;
}

function auditLogger(req, res, next) {
  // Логируем только мутации
  const action = METHOD_TO_ACTION[req.method];
  if (!action) return next();

  // Только /api/*
  const url = req.originalUrl || req.url || '';
  if (!url.startsWith('/api/')) return next();

  const apiPath = url.slice(4).split('?')[0]; // обрезаем "/api"
  if (shouldSkip(apiPath)) return next();

  const rule = matchEntity(apiPath);
  if (!rule) return next();

  const finalAction = rule.action || action;
  const captureBody = rule.captureBody !== false;
  const requestBody = captureBody ? safeStringify(req.body) : null;

  const originalJson = res.json.bind(res);
  res.json = function (data) {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // entityId: из URL, либо из ответа
        let entityId = req.params?.id || null;
        if (!entityId && data && typeof data === 'object') {
          entityId = data.id || data.userId || data._id || data.entityId || null;
        }

        // user: для login достаём из ответа (req.user ещё не установлен)
        let userId = req.user?.id || null;
        let userName = buildUserName(req.user);
        if (!userId && finalAction === 'login' && data?.user) {
          userId = data.user.id || null;
          userName = buildUserName(data.user);
        }

        const entry = {
          userId,
          userName,
          action: finalAction,
          entity: rule.entity,
          entityId: entityId ? String(entityId).slice(0, 200) : null,
          oldData: req._auditOldData ? safeStringify(req._auditOldData) : null,
          newData: requestBody,
          ip: getClientIp(req),
        };

        prisma.auditLog.create({ data: entry }).catch(err => {
          logger.error('Audit log write failed', { error: err.message, path: apiPath });
        });
      }
    } catch (err) {
      logger.error('Audit log middleware error', { error: err.message });
    }
    return originalJson(data);
  };

  next();
}

module.exports = { auditLogger, ENTITY_RULES, SKIP_PATTERNS, redact, safeStringify };
