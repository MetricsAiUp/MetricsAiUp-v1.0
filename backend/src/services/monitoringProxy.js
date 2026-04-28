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

// Transform external zone data to our post format
function transformPost(ext, postNumber) {
  const status = mapStatus(ext);
  const car = ext.car || null;
  return {
    postNumber,
    externalZoneName: ext.zone,
    status,
    plateNumber: car?.plate || null,
    carColor: car?.color || null,
    carModel: car?.model || null,
    carMake: car?.make || null,
    carBody: car?.body || null,
    carFirstSeen: car?.firstSeen || null,
    worksInProgress: ext.worksInProgress || false,
    worksDescription: ext.worksDescription || null,
    peopleCount: ext.peopleCount || 0,
    openParts: ext.openParts || [],
    confidence: ext.confidence || 'LOW',
    lastUpdate: ext.lastUpdate,
    history: ext.history || [],
  };
}

// Transform external zone data to our free zone format
function transformFreeZone(ext, zoneNumber) {
  const car = ext.car || null;
  return {
    zoneNumber,
    externalZoneName: ext.zone,
    status: ext.status, // free or occupied
    plateNumber: car?.plate || null,
    carColor: car?.color || null,
    carModel: car?.model || null,
    carMake: car?.make || null,
    carBody: car?.body || null,
    carFirstSeen: car?.firstSeen || null,
    worksInProgress: ext.worksInProgress || false,
    worksDescription: ext.worksDescription || null,
    peopleCount: ext.peopleCount || 0,
    openParts: ext.openParts || [],
    confidence: ext.confidence || 'LOW',
    lastUpdate: ext.lastUpdate,
    history: ext.history || [],
  };
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

// Track last saved state per zone to avoid duplicate snapshots
const lastSavedState = new Map();

async function saveSnapshots(rawState) {
  if (!rawState || !Array.isArray(rawState)) return;
  const toCreate = [];
  for (const item of rawState) {
    if (!item.zone) continue;
    const key = item.zone;
    const prev = lastSavedState.get(key);
    // Only save if status, plate, or worksInProgress changed
    const plate = item.car?.plate || null;
    const works = !!item.worksInProgress;
    if (prev && prev.status === item.status && prev.plate === plate && prev.works === works) continue;

    lastSavedState.set(key, { status: item.status, plate, works });
    toCreate.push({
      zoneName: item.zone,
      status: item.status || 'free',
      plateNumber: plate,
      carColor: item.car?.color || null,
      carModel: item.car?.model || null,
      carMake: item.car?.make || null,
      carBody: item.car?.body || null,
      worksInProgress: works,
      worksDescription: item.worksDescription || null,
      peopleCount: item.peopleCount || 0,
      confidence: item.confidence || null,
    });
  }
  if (toCreate.length > 0) {
    try {
      await prisma.monitoringSnapshot.createMany({ data: toCreate });
    } catch (err) {
      logger.error('Failed to save monitoring snapshots', { error: err.message });
    }
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

function processState(rawStateInput) {
  if (!rawStateInput || !Array.isArray(rawStateInput)) return;

  const rawState = dropEmptyDuplicates(rawStateInput);
  cachedState = rawState;
  lastFetchTime = new Date();

  // Merge new history entries into full history cache
  mergeHistory(rawState);

  // Persist snapshots to DB (fire-and-forget)
  saveSnapshots(rawState);

  const posts = [];
  const zones = [];

  for (const item of rawState) {
    const postNum = extractPostNumber(item.zone);
    if (postNum && activePostNumbers.has(postNum)) {
      // Skip duplicates (e.g. "Пост 04" and "Пост 04 — легковое/грузовое")
      if (!posts.find(p => p.postNumber === postNum)) {
        posts.push(transformPost(item, postNum));
      }
    }

    const zoneNum = extractFreeZoneNumber(item.zone);
    if (zoneNum && activeFreeZoneNumbers.has(zoneNum)) {
      if (!zones.find(z => z.zoneNumber === zoneNum)) {
        zones.push(transformFreeZone(item, zoneNum));
      }
    }
  }

  posts.sort((a, b) => a.postNumber - b.postNumber);
  zones.sort((a, b) => a.zoneNumber - b.zoneNumber);

  // Detect changes and emit Socket.IO events
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
  if (raw) processState(raw);
}

// ---- Public API ----

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
    }
  } catch (err) {
    logger.error('Failed to load full history', { error: err.message });
  }
}

let historyTimer = null;
const HISTORY_REFRESH_INTERVAL = 5 * 60 * 1000; // refresh full history every 5 min

function start(io) {
  if (pollTimer) return;
  ioRef = io;
  logger.info('Monitoring proxy started', { interval: POLL_INTERVAL });
  // Refresh active post/zone sets from DB, then load history & start polling
  refreshActiveSets()
    .then(() => loadFullHistory())
    .then(() => poll());
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
};
