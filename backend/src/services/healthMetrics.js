/**
 * healthMetrics.js — централизованный агрегатор для /api/system-health.
 *
 * Собирает метрики из:
 *  - process / os (uptime, memory, loadavg, cpus)
 *  - fs (db size, df, ssl cert)
 *  - prisma (sync1c, events, sessions, snapshots, audit, recommendations, telegram, push)
 *  - monitoringProxy (CV API health, lastFetchTime)
 *  - cameraHealthCheck (camera statuses)
 *  - _serviceRegistry (фоновые сервисы)
 *  - локальные fetch (ML :8282, HLS :8181)
 *
 * Кэшируется на 5 секунд, чтобы запросы Health-страницы (раз в 30с) не дёргали
 * лишние fetch'и и тяжёлые SQL-агрегации.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const prisma = require('../config/database');
const logger = require('../config/logger');
const registry = require('./_serviceRegistry');
const monitoringProxy = require('./monitoringProxy');
const { getCameraStatuses } = require('./cameraHealthCheck');

const START_TIME = Date.now();
const CACHE_TTL_MS = 5_000;
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8282/health';
const HLS_URL = process.env.HLS_HEALTH_URL || 'http://localhost:8181/';
const SSL_CERT_PATH = path.resolve(__dirname, '../../../.ssl/fullchain.pem');
const DB_PATH = path.resolve(__dirname, '../../prisma/dev.db');

let cache = null; // { at: timestamp, data }

// ---- helpers ----

async function pingHttp(url, timeoutMs = 2000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return {
      ok: res.ok,
      httpCode: res.status,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      httpCode: 0,
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  }
}

function parseSslExpiry(certPath) {
  try {
    const out = execSync(`openssl x509 -in "${certPath}" -noout -enddate 2>/dev/null`, {
      timeout: 1000,
    }).toString().trim();
    // notAfter=Jul  5 12:00:00 2026 GMT
    const m = out.match(/notAfter=(.+)$/);
    if (!m) return null;
    const expires = new Date(m[1]);
    if (Number.isNaN(expires.getTime())) return null;
    const daysLeft = Math.floor((expires.getTime() - Date.now()) / 86400000);
    return { expiresAt: expires.toISOString(), daysLeft };
  } catch {
    return null;
  }
}

function diskUsage() {
  try {
    const out = execSync('df -B1 / | tail -1').toString().trim();
    const parts = out.split(/\s+/);
    return {
      totalBytes: parseInt(parts[1], 10),
      usedBytes: parseInt(parts[2], 10),
      availableBytes: parseInt(parts[3], 10),
      usagePercent: parseInt(parts[4], 10),
    };
  } catch {
    return null;
  }
}

function ageSeconds(date) {
  if (!date) return null;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 1000);
}

// ---- collectors ----

async function collectBackend() {
  const mem = process.memoryUsage();
  const heapTotal = mem.heapTotal || 1;
  return {
    status: 'ok',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    nodeVersion: process.version,
    pid: process.pid,
    memoryUsage: mem,
    heapPercent: Math.round((mem.heapUsed / heapTotal) * 100),
  };
}

async function collectDatabase() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const pingMs = Date.now() - start;
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(DB_PATH).size; } catch {}
    return {
      status: 'ok',
      pingMs,
      sizeBytes,
      sizeMB: +(sizeBytes / 1024 / 1024).toFixed(2),
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function collectSync1c() {
  try {
    const last = await prisma.syncLog.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!last) return { status: 'never', lastSyncAt: null, ageHours: null };
    const ageSec = ageSeconds(last.createdAt);
    return {
      status: last.status,
      lastSyncAt: last.createdAt.toISOString(),
      ageHours: ageSec != null ? +(ageSec / 3600).toFixed(1) : null,
      records: last.records,
      errors: last.errors,
    };
  } catch (err) {
    return { status: 'unknown', error: err.message };
  }
}

async function collectCvApi() {
  // monitoringProxy poll-based — берём lastFetchTime + ping /monitoring/health
  const lastFetch = monitoringProxy.getLastFetchTime?.() || null;
  const lastFetchAge = ageSeconds(lastFetch);
  const ping = await pingHttp('https://dev.metricsavto.com/p/test1/3100/api/monitoring/health', 2500);
  return {
    status: ping.ok ? 'ok' : (lastFetchAge != null && lastFetchAge < 30 ? 'degraded' : 'down'),
    httpCode: ping.httpCode,
    latencyMs: ping.latencyMs,
    lastFetchAt: lastFetch ? lastFetch.toISOString() : null,
    lastFetchAgeSec: lastFetchAge,
    proxyRunning: !!monitoringProxy.isRunning?.(),
    error: ping.error || null,
  };
}

async function collectMlApi() {
  const ping = await pingHttp(ML_API_URL, 1500);
  return {
    status: ping.ok ? 'ok' : 'down',
    httpCode: ping.httpCode,
    latencyMs: ping.latencyMs,
    url: ML_API_URL,
    error: ping.error || null,
  };
}

async function collectHls() {
  const ping = await pingHttp(HLS_URL, 1500);
  return {
    status: ping.ok ? 'ok' : 'down',
    httpCode: ping.httpCode,
    latencyMs: ping.latencyMs,
    url: HLS_URL,
    error: ping.error || null,
  };
}

async function collectTelegram() {
  try {
    const linked = await prisma.telegramLink.count();
    const reg = registry.get('telegramBot');
    return {
      status: reg?.running ? 'ok' : 'down',
      linkedUsers: linked,
      lastTickAt: reg?.lastTickAt?.toISOString?.() || null,
      lastError: reg?.lastError || null,
    };
  } catch (err) {
    return { status: 'unknown', linkedUsers: 0, error: err.message };
  }
}

async function collectPulse() {
  // Параллельно дёрнем счётчики "пульса" системы.
  const now = new Date();
  const min5Ago = new Date(now.getTime() - 5 * 60_000);
  const hr1Ago = new Date(now.getTime() - 60 * 60_000);
  const hr24Ago = new Date(now.getTime() - 24 * 60 * 60_000);

  try {
    const [
      lastEvent,
      events5m, events1h, events24h,
      snapshots24h,
      sessions24h,
      activeRecs,
      audit24h,
    ] = await Promise.all([
      prisma.event.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, type: true } }),
      prisma.event.count({ where: { createdAt: { gte: min5Ago } } }),
      prisma.event.count({ where: { createdAt: { gte: hr1Ago } } }),
      prisma.event.count({ where: { createdAt: { gte: hr24Ago } } }),
      prisma.monitoringSnapshot.count({ where: { timestamp: { gte: hr24Ago } } }).catch(() => 0),
      prisma.vehicleSession.count({ where: { createdAt: { gte: hr24Ago } } }).catch(() => 0),
      prisma.recommendation.count({ where: { status: 'active' } }).catch(() => 0),
      prisma.auditLog.count({ where: { createdAt: { gte: hr24Ago } } }).catch(() => 0),
    ]);

    return {
      lastEventAt: lastEvent?.createdAt?.toISOString() || null,
      lastEventType: lastEvent?.type || null,
      lastEventAgeSec: ageSeconds(lastEvent?.createdAt),
      eventsLast5m: events5m,
      eventsLast1h: events1h,
      eventsLast24h: events24h,
      snapshotsLast24h: snapshots24h,
      sessionsLast24h: sessions24h,
      activeRecommendations: activeRecs,
      auditEntriesLast24h: audit24h,
    };
  } catch (err) {
    logger.error('collectPulse failed', { error: err.message });
    return { error: err.message };
  }
}

async function collectSecurity() {
  const hr24Ago = new Date(Date.now() - 24 * 60 * 60_000);
  try {
    // Пытаемся достать failed logins из audit-log (action=login_failed)
    const [failedLogins, audit24h, push] = await Promise.all([
      prisma.auditLog.count({
        where: { createdAt: { gte: hr24Ago }, action: 'login_failed' },
      }).catch(() => 0),
      prisma.auditLog.count({ where: { createdAt: { gte: hr24Ago } } }).catch(() => 0),
      prisma.pushSubscription.count().catch(() => 0),
    ]);
    return {
      failedLogins24h: failedLogins,
      auditEntries24h: audit24h,
      pushSubscriptions: push,
    };
  } catch (err) {
    return { error: err.message };
  }
}

function collectResources() {
  const load = os.loadavg();
  const cpus = os.cpus();
  return {
    loadavg: load.map(l => +l.toFixed(2)),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || 'unknown',
    totalMemBytes: os.totalmem(),
    freeMemBytes: os.freemem(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

function collectCameras() {
  try {
    const statuses = getCameraStatuses();
    const list = Object.entries(statuses).map(([id, s]) => ({
      id, online: s.online, lastCheck: s.lastCheck,
    }));
    const online = list.filter(c => c.online).length;
    return { list, online, total: list.length };
  } catch {
    return { list: [], online: 0, total: 0 };
  }
}

function collectServices() {
  return registry.getAll();
}

// ---- verdict + score ----

const PENALTIES = {
  cv_api_down: 30,
  cv_api_stale: 15,           // lastFetchAge > 60s
  events_silent_critical: 20, // lastEventAge > 600s в live-mode
  db_error: 25,
  heap_critical: 15,          // > 95%
  heap_warn: 5,               // > 85%
  disk_critical: 15,          // > 95%
  disk_warn: 5,               // > 85%
  sync1c_critical: 10,        // > 7d
  sync1c_warn: 3,             // > 24h
  ml_down: 5,
  hls_down: 5,
  telegram_down: 5,
  ssl_critical: 10,           // < 7 days
  ssl_warn: 3,                // < 30 days
};

function computeVerdict(snapshot) {
  const failures = [];
  let penalty = 0;

  const { backend, database, sync1c, dataSources, pulse, disk, ssl } = snapshot;

  // CV API
  if (dataSources?.cvApi) {
    const cv = dataSources.cvApi;
    if (cv.status === 'down') { failures.push('cv_api_down'); penalty += PENALTIES.cv_api_down; }
    else if (cv.lastFetchAgeSec != null && cv.lastFetchAgeSec > 60) {
      failures.push('cv_api_stale'); penalty += PENALTIES.cv_api_stale;
    }
  }

  // Events stream
  if (pulse?.lastEventAgeSec != null && pulse.lastEventAgeSec > 600) {
    failures.push('events_silent'); penalty += PENALTIES.events_silent_critical;
  }

  // DB
  if (database?.status !== 'ok') {
    failures.push('db_error'); penalty += PENALTIES.db_error;
  }

  // Heap
  if (backend?.heapPercent > 95) {
    failures.push('heap_critical'); penalty += PENALTIES.heap_critical;
  } else if (backend?.heapPercent > 85) {
    failures.push('heap_warn'); penalty += PENALTIES.heap_warn;
  }

  // Disk
  if (disk?.usagePercent > 95) {
    failures.push('disk_critical'); penalty += PENALTIES.disk_critical;
  } else if (disk?.usagePercent > 85) {
    failures.push('disk_warn'); penalty += PENALTIES.disk_warn;
  }

  // 1C
  if (sync1c?.ageHours != null) {
    if (sync1c.ageHours > 24 * 7) {
      failures.push('sync1c_stale_critical'); penalty += PENALTIES.sync1c_critical;
    } else if (sync1c.ageHours > 24) {
      failures.push('sync1c_stale'); penalty += PENALTIES.sync1c_warn;
    }
  }

  // ML / HLS / Telegram
  if (dataSources?.mlApi?.status === 'down') {
    failures.push('ml_down'); penalty += PENALTIES.ml_down;
  }
  if (dataSources?.hls?.status === 'down') {
    failures.push('hls_down'); penalty += PENALTIES.hls_down;
  }
  if (dataSources?.telegram?.status === 'down') {
    failures.push('telegram_down'); penalty += PENALTIES.telegram_down;
  }

  // SSL
  if (ssl?.daysLeft != null) {
    if (ssl.daysLeft < 7) { failures.push('ssl_critical'); penalty += PENALTIES.ssl_critical; }
    else if (ssl.daysLeft < 30) { failures.push('ssl_expiring'); penalty += PENALTIES.ssl_warn; }
  }

  const score = Math.max(0, 100 - penalty);
  let level = 'ok';
  if (score < 70) level = 'critical';
  else if (score < 90) level = 'warn';

  return { score, level, failures };
}

// ---- orchestrator ----

async function collect() {
  const [
    backend, database, sync1c, cvApi, mlApi, hls, telegram, pulse, security,
  ] = await Promise.all([
    collectBackend(),
    collectDatabase(),
    collectSync1c(),
    collectCvApi(),
    collectMlApi(),
    collectHls(),
    collectTelegram(),
    collectPulse(),
    collectSecurity(),
  ]);

  const disk = diskUsage();
  const ssl = parseSslExpiry(SSL_CERT_PATH);
  const resources = collectResources();
  const cameras = collectCameras();
  const services = collectServices();

  const snapshot = {
    backend,
    database,
    sync1c,
    dataSources: { cvApi, mlApi, hls, telegram },
    pulse,
    disk,
    ssl,
    resources,
    security,
    cameras,
    services,
  };

  snapshot.verdict = computeVerdict(snapshot);
  return snapshot;
}

async function getHealth({ noCache = false } = {}) {
  const now = Date.now();
  if (!noCache && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  const data = await collect();
  cache = { at: now, data };
  return data;
}

function clearCache() {
  cache = null;
}

module.exports = {
  getHealth,
  clearCache,
  computeVerdict,
  // exposed for tests
  _internal: { ageSeconds, pingHttp, parseSslExpiry, diskUsage },
};
