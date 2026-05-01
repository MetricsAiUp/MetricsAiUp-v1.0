/**
 * Monitoring Proxy Service
 *
 * Polls external CV monitoring API and caches results.
 * In live mode, this is the single source of truth for post/zone statuses.
 *
 * External API: https://dev.metricsavto.com/p/test1/3100/api/monitoring/state
 */

const logger = require('../config/logger');
const prisma = require('../config/database');

const MONITORING_API_BASE = 'https://dev.metricsavto.com/p/test1/3100/api';
const POLL_INTERVAL = 10_000; // 10 seconds

// In-memory cache of latest monitoring state
let cachedState = null;        // full array from external API
let cachedPosts = [];          // mapped posts (active in DB)
let cachedZones = [];          // mapped free zones (active in DB)
let cachedFullHistory = null;  // full state with all history (loaded once at start)
let lastFetchTime = null;
let pollTimer = null;
let ioRef = null;

// Active post/zone numbers from DB (source of truth — Post.number / Zone.name).
// Refreshed periodically and on map:synced event so MapEditor changes propagate
// without restart. Replaces previous hardcoded ranges (<= 11, <= 7).
let activePostNumbers = new Set();
let activeFreeZoneNumbers = new Set();
let activeSetsRefreshTimer = null;
const ACTIVE_SETS_REFRESH_INTERVAL = 60_000; // 60 sec

async function refreshActiveSets() {
  try {
    const posts = await prisma.post.findMany({
      where: { deleted: false, number: { not: null } },
      select: { number: true },
    });
    activePostNumbers = new Set(posts.map(p => p.number));

    const zones = await prisma.zone.findMany({
      where: { deleted: false },
      select: { name: true },
    });
    const zoneNums = new Set();
    for (const z of zones) {
      const m = (z.name || '').match(/(\d+)/);
      if (m) zoneNums.add(parseInt(m[1], 10));
    }
    activeFreeZoneNumbers = zoneNums;
  } catch (err) {
    logger.error('Failed to refresh active map sets', { error: err.message });
  }
}

// Map external zone name → internal post number (1-10)
// External: "Пост 01 — легковое", "Пост 02 — легковое", ..., "Пост 06 — шиномонтаж", etc.
function extractPostNumber(zoneName) {
  const m = zoneName.match(/^Пост\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// Map external zone name → free zone number (1-7)
// External: "Свободная зона 01 — оклейка/стекла", etc.
function extractFreeZoneNumber(zoneName) {
  const m = zoneName.match(/^Свободная зона\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// Map external status → our internal post status
function mapStatus(ext) {
  if (ext.status === 'free') return 'free';
  // occupied + works in progress = active_work
  if (ext.worksInProgress) return 'active_work';
  // occupied, no work = occupied (vehicle present, no activity)
  return 'occupied';
}

async function fetchMonitoringState(from, to) {
  try {
    let url = `${MONITORING_API_BASE}/monitoring/state`;
    if (from && to) {
      url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Monitoring API error', { status: res.status });
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.error('Monitoring API fetch failed', { error: err.message });
    return null;
  }
}

async function fetchMonitoringHistory(from, to) {
  try {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`${MONITORING_API_BASE}/monitoring/history?${params}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    logger.error('Monitoring history fetch failed', { error: err.message });
    return [];
  }
}

async function fetchMonitoringHealth() {
  try {
    const res = await fetch(`${MONITORING_API_BASE}/monitoring/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function fetchMonitoringCameras() {
  try {
    const res = await fetch(`${MONITORING_API_BASE}/monitoring/cameras`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    logger.error('Monitoring cameras fetch failed', { error: err.message });
    return [];
  }
}

// Track last saved state per zone to avoid duplicate snapshots.
// Снимки в monitoring_snapshots — append-only история; пишем только при
// изменении значимых полей (status, plate, works, openParts, peopleCount).
const lastSavedState = new Map();

// Преобразование значений внешнего API в формат БД.
function carFirstSeenDate(item) {
  const v = item?.car?.firstSeen;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function externalUpdateDate(item) {
  const v = item?.lastUpdate;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function openPartsJson(item) {
  const arr = Array.isArray(item?.openParts) ? item.openParts : [];
  return arr.length ? JSON.stringify(arr) : null;
}

// Полная запись внешнего состояния в БД:
// 1) MonitoringCurrent — upsert (всегда, отражает актуальное состояние);
// 2) MonitoringSnapshot — insert только при изменении значимых полей.
async function persistToDb(rawState) {
  if (!rawState || !Array.isArray(rawState)) return;

  const snapshotsToCreate = [];
  const upsertOps = [];

  for (const item of rawState) {
    if (!item.zone) continue;
    const plate = item.car?.plate || null;
    const works = !!item.worksInProgress;
    const peopleCount = item.peopleCount || 0;
    const openPartsStr = openPartsJson(item);
    const status = item.status || 'free';
    const confidence = item.confidence || null;

    const baseRow = {
      externalType: item.type || null,
      status,
      plateNumber: plate,
      carColor: item.car?.color || null,
      carModel: item.car?.model || null,
      carMake: item.car?.make || null,
      carBody: item.car?.body || null,
      carFirstSeen: carFirstSeenDate(item),
      worksInProgress: works,
      worksDescription: item.worksDescription || null,
      peopleCount,
      openParts: openPartsStr,
      confidence,
      externalUpdate: externalUpdateDate(item),
    };

    upsertOps.push(
      prisma.monitoringCurrent.upsert({
        where: { zoneName: item.zone },
        create: { zoneName: item.zone, ...baseRow, fetchedAt: new Date() },
        update: { ...baseRow, fetchedAt: new Date() },
      })
    );

    // Дедуп для snapshot-таблицы — расширенный набор ключей.
    const dedupKey = JSON.stringify({
      s: status, p: plate, w: works, pc: peopleCount, op: openPartsStr, c: confidence,
    });
    const prev = lastSavedState.get(item.zone);
    if (prev !== dedupKey) {
      lastSavedState.set(item.zone, dedupKey);
      snapshotsToCreate.push({ zoneName: item.zone, ...baseRow });
    }
  }

  try {
    // Параллельно upsert текущих состояний.
    if (upsertOps.length) await Promise.all(upsertOps);
    // И append истории изменений.
    if (snapshotsToCreate.length) {
      await prisma.monitoringSnapshot.createMany({ data: snapshotsToCreate });
    }
  } catch (err) {
    logger.error('Failed to persist monitoring state to DB', { error: err.message });
  }
}

// Прочитать MonitoringCurrent и собрать кэш постов/зон в формате,
// совместимом с потребителями (posts-analytics, /api/monitoring/state).
async function refreshCacheFromDb() {
  let rows;
  try {
    rows = await prisma.monitoringCurrent.findMany();
  } catch (err) {
    logger.error('Failed to load monitoring_current from DB', { error: err.message });
    return { posts: [], zones: [] };
  }

  // Маппинг статуса для постов: free / active_work (occupied + worksInProgress) / occupied.
  const postStatus = (row) => {
    if (row.status === 'free') return 'free';
    if (row.worksInProgress) return 'active_work';
    return 'occupied';
  };
  // Свободные зоны имеют только two states (free/occupied) — на карте/в дашборде
  // не различают active_work, чтобы не сломать рендер ZoneEl. Возвращаем raw status.
  const zoneStatus = (row) => row.status === 'free' ? 'free' : 'occupied';

  const posts = [];
  const zones = [];

  for (const row of rows) {
    const baseFields = {
      externalZoneName: row.zoneName,
      externalType: row.externalType,
      plateNumber: row.plateNumber,
      carColor: row.carColor,
      carModel: row.carModel,
      carMake: row.carMake,
      carBody: row.carBody,
      carFirstSeen: row.carFirstSeen ? row.carFirstSeen.toISOString() : null,
      worksInProgress: row.worksInProgress,
      worksDescription: row.worksDescription,
      peopleCount: row.peopleCount,
      openParts: row.openParts ? safeJsonArray(row.openParts) : [],
      confidence: row.confidence,
      lastUpdate: row.externalUpdate ? row.externalUpdate.toISOString() : null,
      fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : null,
      // history — заполним ниже из cachedFullHistory (если есть).
      history: [],
    };

    const postNum = extractPostNumber(row.zoneName);
    if (postNum && activePostNumbers.has(postNum) && !posts.find(p => p.postNumber === postNum)) {
      posts.push({ postNumber: postNum, status: postStatus(row), ...baseFields });
      continue;
    }
    const zoneNum = extractFreeZoneNumber(row.zoneName);
    if (zoneNum && activeFreeZoneNumbers.has(zoneNum) && !zones.find(z => z.zoneNumber === zoneNum)) {
      zones.push({ zoneNumber: zoneNum, status: zoneStatus(row), ...baseFields });
    }
  }

  // Проставим history из cachedFullHistory (если он успел загрузиться) — это
  // богатая последовательность записей, нужная аналитике factHours/efficiency.
  if (cachedFullHistory) {
    for (const p of posts) {
      const cached = cachedFullHistory.find(z => z.zone === p.externalZoneName);
      if (cached?.history) p.history = cached.history;
    }
    for (const z of zones) {
      const cached = cachedFullHistory.find(c => c.zone === z.externalZoneName);
      if (cached?.history) z.history = cached.history;
    }
  }

  posts.sort((a, b) => a.postNumber - b.postNumber);
  zones.sort((a, b) => a.zoneNumber - b.zoneNumber);
  return { posts, zones };
}

function safeJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function mergeHistory(rawState) {
  if (!cachedFullHistory || !rawState) return;
  for (const item of rawState) {
    const cached = cachedFullHistory.find(z => z.zone === item.zone);
    if (cached && item.history?.length) {
      const existingTs = new Set(cached.history.map(h => h.timestamp));
      for (const h of item.history) {
        if (!existingTs.has(h.timestamp)) {
          cached.history.push(h);
        }
      }
    } else if (!cached && item.history?.length) {
      cachedFullHistory.push(item);
    }
    // Update current state fields
    if (cached) {
      cached.status = item.status;
      cached.car = item.car;
      cached.worksInProgress = item.worksInProgress;
      cached.worksDescription = item.worksDescription;
      cached.peopleCount = item.peopleCount;
      cached.lastUpdate = item.lastUpdate;
    }
  }
}

// Drop trashy bare duplicates from CV API.
// External API returns both "Пост 04" (bare) and "Пост 04 — легковое/грузовое" (real).
// The bare variant is always noise — drop it whenever a suffixed variant exists
// for the same post/zone number, regardless of history content.
function dropEmptyDuplicates(rawState) {
  if (!Array.isArray(rawState)) return rawState;
  const hasSuffixed = new Map(); // groupKey → true if suffixed variant exists
  const isSuffixed = (zone) => /—/.test(zone || '');
  const groupKey = (zone) => {
    const p = extractPostNumber(zone);
    if (p) return `post:${p}`;
    const z = extractFreeZoneNumber(zone);
    if (z) return `zone:${z}`;
    return null;
  };
  for (const item of rawState) {
    const key = groupKey(item.zone);
    if (key && isSuffixed(item.zone)) hasSuffixed.set(key, true);
  }
  return rawState.filter(item => {
    const key = groupKey(item.zone);
    if (!key) return true;
    // Drop bare entry if a suffixed sibling exists for this number
    if (!isSuffixed(item.zone) && hasSuffixed.get(key)) return false;
    return true;
  });
}

// Полный цикл write-through: external → DB → cache → emit.
// БД — источник истины для live-режима; в кэш загружаем из MonitoringCurrent.
async function processState(rawStateInput) {
  if (!rawStateInput || !Array.isArray(rawStateInput)) return;

  const rawState = dropEmptyDuplicates(rawStateInput);
  cachedState = rawState;
  lastFetchTime = new Date();

  // Слить новые записи истории в долгоживущий in-memory кэш истории.
  mergeHistory(rawState);

  // 1) Сначала пишем внешнее состояние в БД (current + snapshot при изменении).
  await persistToDb(rawState);

  // 2) Перечитываем кэш постов/зон из БД — БД источник истины.
  const { posts, zones } = await refreshCacheFromDb();

  // 3) Diff против предыдущего кэша → Socket.IO events.
  if (ioRef) {
    for (const newPost of posts) {
      const old = cachedPosts.find(p => p.postNumber === newPost.postNumber);
      if (!old || old.status !== newPost.status || old.plateNumber !== newPost.plateNumber) {
        ioRef.emit('post:status_changed', {
          postNumber: newPost.postNumber,
          status: newPost.status,
          plateNumber: newPost.plateNumber,
          carModel: newPost.carModel,
          worksInProgress: newPost.worksInProgress,
          peopleCount: newPost.peopleCount,
          source: 'monitoring',
        });
      }
    }
    for (const newZone of zones) {
      const old = cachedZones.find(z => z.zoneNumber === newZone.zoneNumber);
      if (!old || old.status !== newZone.status || old.plateNumber !== newZone.plateNumber) {
        ioRef.emit('zone:status_changed', {
          zoneNumber: newZone.zoneNumber,
          status: newZone.status,
          plateNumber: newZone.plateNumber,
          carModel: newZone.carModel,
          worksInProgress: newZone.worksInProgress,
          source: 'monitoring',
        });
      }
    }
  }

  cachedPosts = posts;
  cachedZones = zones;
}

async function poll() {
  const raw = await fetchMonitoringState();
  if (raw) await processState(raw);
}

// ---- Public API ----

// Backfill — записать недостающие записи истории из внешнего API в нашу БД.
// Берём latest timestamp в monitoring_snapshots по zoneName и пишем только новее.
async function backfillHistoryToDb(fullHistory) {
  if (!Array.isArray(fullHistory) || fullHistory.length === 0) return 0;
  let inserted = 0;
  for (const item of fullHistory) {
    if (!item.zone || !Array.isArray(item.history) || item.history.length === 0) continue;
    let latestTs = null;
    try {
      const latest = await prisma.monitoringSnapshot.findFirst({
        where: { zoneName: item.zone },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      latestTs = latest?.timestamp || null;
    } catch (err) {
      logger.error('Backfill: failed to read latest snapshot', { zone: item.zone, error: err.message });
      continue;
    }
    const toCreate = [];
    for (const h of item.history) {
      const ts = h.timestamp ? new Date(h.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (latestTs && ts <= latestTs) continue;
      const car = h.car || null;
      toCreate.push({
        zoneName: item.zone,
        externalType: item.type || null,
        status: h.status || 'free',
        plateNumber: car?.plate || null,
        carColor: car?.color || null,
        carModel: car?.model || null,
        carMake: car?.make || null,
        carBody: car?.body || null,
        carFirstSeen: car?.firstSeen ? (() => { const d = new Date(car.firstSeen); return Number.isNaN(d.getTime()) ? null : d; })() : null,
        worksInProgress: !!h.worksInProgress,
        worksDescription: h.worksDescription || null,
        peopleCount: h.peopleCount || 0,
        openParts: Array.isArray(h.openParts) && h.openParts.length ? JSON.stringify(h.openParts) : null,
        confidence: h.confidence || null,
        externalUpdate: ts,
        timestamp: ts,
      });
    }
    if (toCreate.length) {
      try {
        // createMany не поддерживает skipDuplicates по @id default(uuid), но дубли исключаются по latestTs.
        await prisma.monitoringSnapshot.createMany({ data: toCreate });
        inserted += toCreate.length;
      } catch (err) {
        logger.error('Backfill: createMany failed', { zone: item.zone, error: err.message });
      }
    }
  }
  return inserted;
}

async function loadFullHistory() {
  try {
    // Load all available history (from earliest known date)
    const from = '2026-04-01T00:00:00Z';
    const to = new Date().toISOString();
    logger.info('Loading full monitoring history', { from, to });
    const raw = await fetchMonitoringState(from, to);
    if (raw && Array.isArray(raw)) {
      cachedFullHistory = dropEmptyDuplicates(raw);
      const totalHistory = cachedFullHistory.reduce((sum, z) => sum + (z.history?.length || 0), 0);
      logger.info('Full history loaded', { zones: cachedFullHistory.length, historyRecords: totalHistory });
      // Сохранить недостающие записи в нашу БД (write-through истории).
      const inserted = await backfillHistoryToDb(cachedFullHistory);
      if (inserted > 0) logger.info('Backfilled history into DB', { inserted });
    }
  } catch (err) {
    logger.error('Failed to load full history', { error: err.message });
  }
}

let historyTimer = null;
const HISTORY_REFRESH_INTERVAL = 5 * 60 * 1000; // refresh full history every 5 min

async function start(io) {
  if (pollTimer) return;
  ioRef = io;
  logger.info('Monitoring proxy started', { interval: POLL_INTERVAL });

  // Hydrate from DB BEFORE any external fetches.
  // Без этого после рестарта /api/monitoring/state отдаёт [] до первого
  // успешного poll, который зависит от внешнего CV API.
  await refreshActiveSets();
  try {
    const { posts, zones } = await refreshCacheFromDb();
    cachedPosts = posts;
    cachedZones = zones;

    // Гидрация lastSavedState: чтобы первый poll после рестарта не писал
    // дубликаты в MonitoringSnapshot, если внешнее состояние не изменилось.
    const currentRows = await prisma.monitoringCurrent.findMany();
    for (const row of currentRows) {
      const dedupKey = JSON.stringify({
        s: row.status,
        p: row.plateNumber,
        w: row.worksInProgress,
        pc: row.peopleCount,
        op: row.openParts,
        c: row.confidence,
      });
      lastSavedState.set(row.zoneName, dedupKey);
    }

    logger.info('Monitoring cache hydrated from DB', {
      posts: posts.length,
      zones: zones.length,
      dedupKeys: currentRows.length,
    });
  } catch (err) {
    logger.error('Cache hydration failed', { error: err.message });
  }

  // Затем запускаем внешние fetch'и.
  loadFullHistory().then(() => poll());
  pollTimer = setInterval(poll, POLL_INTERVAL);
  historyTimer = setInterval(loadFullHistory, HISTORY_REFRESH_INTERVAL);
  activeSetsRefreshTimer = setInterval(refreshActiveSets, ACTIVE_SETS_REFRESH_INTERVAL);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (historyTimer) {
    clearInterval(historyTimer);
    historyTimer = null;
  }
  if (activeSetsRefreshTimer) {
    clearInterval(activeSetsRefreshTimer);
    activeSetsRefreshTimer = null;
  }
  logger.info('Monitoring proxy stopped');
}

function isRunning() {
  return pollTimer !== null;
}

// Get cached posts (1-10) for live mode
function getPosts() {
  return cachedPosts;
}

// Get cached free zones (1-7) for live mode
function getFreeZones() {
  return cachedZones;
}

// Get full raw state
function getRawState() {
  return cachedState;
}

function getLastFetchTime() {
  return lastFetchTime;
}

// Get post by number
function getPost(num) {
  return cachedPosts.find(p => p.postNumber === num) || null;
}

// Get zone by number
function getFreeZone(num) {
  return cachedZones.find(z => z.zoneNumber === num) || null;
}

// Summary for dashboard
function getSummary() {
  const totalPosts = cachedPosts.length;
  const working = cachedPosts.filter(p => p.status === 'active_work').length;
  const occupied = cachedPosts.filter(p => p.status !== 'free').length;
  const free = cachedPosts.filter(p => p.status === 'free').length;
  const idle = cachedPosts.filter(p => p.status === 'occupied').length;

  const totalZones = cachedZones.length;
  const zonesOccupied = cachedZones.filter(z => z.status === 'occupied').length;
  const zonesFree = cachedZones.filter(z => z.status === 'free').length;

  return {
    posts: { total: totalPosts, working, occupied, free, idle },
    zones: { total: totalZones, occupied: zonesOccupied, free: zonesFree },
    vehiclesOnSite: occupied + zonesOccupied,
    lastUpdate: lastFetchTime?.toISOString() || null,
  };
}

// Get full history (all zones with history arrays)
function getFullHistory() {
  return cachedFullHistory;
}

// Get post history from full history cache
function getPostHistory(postNumber) {
  if (!cachedFullHistory) return null;
  for (const item of cachedFullHistory) {
    const num = extractPostNumber(item.zone);
    if (num === postNumber) return item;
  }
  return null;
}

// Fetch state with history for a period (proxies to external API with from/to)
async function fetchStateForPeriod(from, to) {
  return fetchMonitoringState(from, to);
}

// Get zone history from local DB
async function getZoneHistoryFromDB(zoneName, from, to) {
  const where = { zoneName };
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) where.timestamp.lte = new Date(to);
  }
  const snapshots = await prisma.monitoringSnapshot.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 5000,
  });
  return snapshots.map(s => ({
    timestamp: s.timestamp.toISOString(),
    status: s.status,
    car: {
      plate: s.plateNumber, color: s.carColor,
      model: s.carModel, make: s.carMake, body: s.carBody, firstSeen: null,
    },
    worksInProgress: s.worksInProgress,
    worksDescription: s.worksDescription,
    peopleCount: s.peopleCount,
    confidence: s.confidence,
  }));
}

// Get all zone names that have DB history
async function getZoneNamesFromDB() {
  const result = await prisma.monitoringSnapshot.findMany({
    distinct: ['zoneName'],
    select: { zoneName: true },
  });
  return result.map(r => r.zoneName);
}

// Статистика БД мониторинга для LiveDebug.
async function getDbStats() {
  try {
    const [snapshotsTotal, currentTotal, latestSnapshot, latestCurrent, perZoneRaw] = await Promise.all([
      prisma.monitoringSnapshot.count(),
      prisma.monitoringCurrent.count(),
      prisma.monitoringSnapshot.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
      prisma.monitoringCurrent.findFirst({
        orderBy: { fetchedAt: 'desc' },
        select: { fetchedAt: true },
      }),
      prisma.monitoringSnapshot.groupBy({
        by: ['zoneName'],
        _count: { _all: true },
        _max: { timestamp: true },
      }),
    ]);
    const perZone = perZoneRaw
      .map(r => ({
        zoneName: r.zoneName,
        snapshots: r._count._all,
        latest: r._max.timestamp ? r._max.timestamp.toISOString() : null,
      }))
      .sort((a, b) => a.zoneName.localeCompare(b.zoneName, 'ru'));
    return {
      snapshotsTotal,
      currentTotal,
      latestSnapshot: latestSnapshot?.timestamp?.toISOString() || null,
      latestFetch: latestCurrent?.fetchedAt?.toISOString() || null,
      perZone,
    };
  } catch (err) {
    logger.error('Failed to compute monitoring DB stats', { error: err.message });
    return {
      snapshotsTotal: 0,
      currentTotal: 0,
      latestSnapshot: null,
      latestFetch: null,
      perZone: [],
      error: err.message,
    };
  }
}

// Прочитать актуальное состояние всех зон/постов из MonitoringCurrent.
// Используется для LiveDebug — показать всё, что сейчас лежит в БД.
async function getCurrentFromDB() {
  const rows = await prisma.monitoringCurrent.findMany({
    orderBy: { zoneName: 'asc' },
  });
  return rows.map(r => ({
    zoneName: r.zoneName,
    externalType: r.externalType,
    status: r.status,
    plateNumber: r.plateNumber,
    carColor: r.carColor,
    carModel: r.carModel,
    carMake: r.carMake,
    carBody: r.carBody,
    carFirstSeen: r.carFirstSeen ? r.carFirstSeen.toISOString() : null,
    worksInProgress: r.worksInProgress,
    worksDescription: r.worksDescription,
    peopleCount: r.peopleCount,
    openParts: r.openParts ? safeJsonArray(r.openParts) : [],
    confidence: r.confidence,
    externalUpdate: r.externalUpdate ? r.externalUpdate.toISOString() : null,
    fetchedAt: r.fetchedAt ? r.fetchedAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));
}

module.exports = {
  start,
  stop,
  isRunning,
  getPosts,
  getFreeZones,
  getRawState,
  getLastFetchTime,
  getPost,
  getFreeZone,
  getSummary,
  getFullHistory,
  getPostHistory,
  fetchStateForPeriod,
  fetchMonitoringHistory,
  fetchMonitoringHealth,
  fetchMonitoringCameras,
  getZoneHistoryFromDB,
  getZoneNamesFromDB,
  refreshActiveSets,
  getDbStats,
  getCurrentFromDB,
};
