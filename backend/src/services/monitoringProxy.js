/**
 * Monitoring Proxy Service
 *
 * Polls external CV monitoring API and caches results.
 * In live mode, this is the single source of truth for post/zone statuses.
 *
 * External API: https://dev.metricsavto.com/p/test1/3100/api/monitoring/state
 */

const logger = require('../config/logger');

const MONITORING_API_BASE = 'https://dev.metricsavto.com/p/test1/3100/api';
const POLL_INTERVAL = 10_000; // 10 seconds

// In-memory cache of latest monitoring state
let cachedState = null;        // full array from external API
let cachedPosts = [];          // mapped posts (01-10)
let cachedZones = [];          // mapped free zones (01-07)
let cachedFullHistory = null;  // full state with all history (loaded once at start)
let lastFetchTime = null;
let pollTimer = null;
let ioRef = null;

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

function processState(rawState) {
  if (!rawState || !Array.isArray(rawState)) return;

  cachedState = rawState;
  lastFetchTime = new Date();

  const posts = [];
  const zones = [];

  for (const item of rawState) {
    const postNum = extractPostNumber(item.zone);
    if (postNum && postNum >= 1 && postNum <= 10) {
      // Skip duplicates (e.g. "Пост 04" and "Пост 04 — легковое/грузовое")
      if (!posts.find(p => p.postNumber === postNum)) {
        posts.push(transformPost(item, postNum));
      }
    }

    const zoneNum = extractFreeZoneNumber(item.zone);
    if (zoneNum && zoneNum >= 1 && zoneNum <= 7) {
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
      cachedFullHistory = raw;
      const totalHistory = raw.reduce((sum, z) => sum + (z.history?.length || 0), 0);
      logger.info('Full history loaded', { zones: raw.length, historyRecords: totalHistory });
    }
  } catch (err) {
    logger.error('Failed to load full history', { error: err.message });
  }
}

function start(io) {
  if (pollTimer) return;
  ioRef = io;
  logger.info('Monitoring proxy started', { interval: POLL_INTERVAL });
  // Load full history, then start polling
  loadFullHistory().then(() => poll());
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('Monitoring proxy stopped');
  }
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
};
