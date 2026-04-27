const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { read } = require('./storage');
const { analyzeZoneImage, loadSettings } = require('./vision');
const { enqueue } = require('./monitoringDb');
const { nudge } = require('./dbWorker');
const { mergeAnalyses } = require('./zoneVerdict');

let pollTimer = null;
let running = false;
let lastRun = null;
let currentCycle = null;
let intervalMs = 60000;
let changeThreshold = 5; // % of pixels changed to trigger analysis
let stats = { cyclesTotal: 0, zonesAnalyzed: 0, zonesSkipped: 0, lastCycleDuration: 0, apiCalls: 0 };

// === Live event stream for UI observers ===
// bus carries lifecycle events; recent[] keeps a replay tail so a freshly
// connecting client immediately sees the last activity instead of an empty
// screen waiting for the next cycle.
const bus = new EventEmitter();
bus.setMaxListeners(50); // each SSE client is one listener
const RECENT_LIMIT = 250;
const recent = [];
// Live "current activity" snapshot — what zone/camera is being processed
// right now; replaced as the cycle moves forward.
let liveState = { cycleNum: 0, currentZone: null, currentCamera: null, phase: 'idle' };

function emit(name, payload) {
  const ev = { name, ts: new Date().toISOString(), ...payload };
  recent.push(ev);
  if (recent.length > RECENT_LIMIT) recent.shift();
  bus.emit('event', ev);
}

// Previous frame hashes per zone for change detection
const prevFrames = {}; // key: `${camId}_${zoneName}` → { buffer, hash }

// Latest JPEG per (zone, camera) — cached so the observer page can render
// the same crop the server just analyzed without re-hitting the camera proxy.
// key: `${zoneName}__${camId}` → { jpeg, ts }
const lastCrops = {};
function cropKey(zoneName, camId) { return `${zoneName}__${camId}`; }
function getLastCrop(zoneName, camId) { return lastCrops[cropKey(zoneName, camId)] || null; }

const CAMERA_SERVER = 'http://127.0.0.1:8181';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Fetch a FULL camera frame (no crop). The v2 ANPR service needs the original
 * resolution to OCR plates — pre-cropping to the zone rect leaves the plate at
 * ~50×20 px which is below nomeroff's confident range. We pass the zone bbox
 * separately to v2 so it knows which area to attribute matches to.
 */
function fetchFullFrame(camId) {
  return httpGet(`${CAMERA_SERVER}/api/stream/snapshot/${camId}`);
}

/**
 * Compare two JPEG buffers by size + hash.
 * If the JPEG size differs by >changeThreshold% or hash changed → content changed.
 * This is a fast heuristic: same scene with no change produces nearly identical JPEGs.
 */
function hasContentChanged(key, newBuffer) {
  const newHash = crypto.createHash('md5').update(newBuffer).digest('hex');
  const prev = prevFrames[key];

  // Store for next comparison
  prevFrames[key] = { size: newBuffer.length, hash: newHash };

  if (!prev) return true; // first frame — always analyze

  // Hash exact match — nothing changed
  if (prev.hash === newHash) return false;

  // Size-based heuristic: if JPEG size changed by >threshold% — content likely changed
  const sizeDiff = Math.abs(newBuffer.length - prev.size) / prev.size * 100;
  return sizeDiff > changeThreshold;
}

async function runOnce() {
  const startTime = Date.now();
  const store = read();
  const settings = loadSettings();
  if (!settings.anthropicApiKey) {
    console.log('[AutoPoll] No API key configured, skipping');
    return { error: 'No API key' };
  }

  const cycleNum = stats.cyclesTotal + 1;
  liveState = { cycleNum, currentZone: null, currentCamera: null, phase: 'starting' };
  emit('cycle_start', { cycleNum });

  const results = [];
  let skipped = 0;

  for (const room of store.rooms || []) {
    // Only poll "Настоящая ремзона", skip test rooms
    if (!room.name || !room.name.includes('Настоящая')) continue;

    const zones3d = room.zones || [];
    const cameras = room.cameras || [];

    // Build zone→cameras map
    const zoneMap = {};
    for (const z of zones3d) {
      zoneMap[z.name] = { zoneId: z.id, type: z.type || 'lift', cameras: [] };
    }

    for (const cam of cameras) {
      if (!cam.rtspCameraId || !cam.zones2d || !cam.zones2d.length) continue;
      for (const z2d of cam.zones2d) {
        let entry = zoneMap[z2d.zoneName];
        if (!entry) {
          for (const [k, v] of Object.entries(zoneMap)) {
            if (v.zoneId === z2d.zoneId) { entry = v; break; }
          }
        }
        if (entry) {
          entry.cameras.push({
            camId: cam.rtspCameraId, camName: cam.name,
            rect: z2d.rect, resolution: cam.resolution || { width: 1920, height: 1080 },
          });
        }
      }
    }

    for (const [zoneName, entry] of Object.entries(zoneMap)) {
      if (entry.cameras.length === 0) continue;

      liveState = { cycleNum, currentZone: zoneName, currentCamera: null, phase: 'fetching' };
      emit('zone_start', {
        cycleNum, zoneName, zoneType: entry.type,
        cameras: entry.cameras.map(c => ({ camId: c.camId, camName: c.camName })),
      });

      // Step 1: Fetch crops from all cameras and check for changes
      let anyChanged = false;
      const crops = [];

      for (const cam of entry.cameras) {
        liveState = { cycleNum, currentZone: zoneName, currentCamera: cam.camName, phase: 'fetching' };
        try {
          const jpegBuffer = await fetchFullFrame(cam.camId);
          const key = `${cam.camId}_${zoneName}`;
          const changed = hasContentChanged(key, jpegBuffer);
          // Cache for the observer page (full frame). The page will CSS-crop
          // to cam.rect on its side using the rect/resolution we ship in the
          // SSE event. cycleNum is the client's cache-buster.
          lastCrops[cropKey(zoneName, cam.camId)] = {
            jpeg: jpegBuffer, ts: Date.now(), cycleNum,
            rect: cam.rect, resolution: cam.resolution,
          };
          crops.push({ cam, jpegBuffer, changed });
          if (changed) anyChanged = true;
          emit('crop_fetched', {
            cycleNum, zoneName, camId: cam.camId, camName: cam.camName,
            changed, jpegSize: jpegBuffer.length,
            rect: cam.rect, resolution: cam.resolution,
          });
        } catch (err) {
          console.error(`[AutoPoll] ${cam.camName} crop error for "${zoneName}": ${err.message}`);
          crops.push({ cam, jpegBuffer: null, changed: false, error: true });
          emit('crop_error', {
            cycleNum, zoneName, camId: cam.camId, camName: cam.camName, error: err.message,
          });
        }
      }

      // Mode switch: 'always' analyzes every cycle (preferred when the
      // recognition service is local/free), 'on_change' skips when the
      // JPEG-hash heuristic sees no visual change (saves load when using
      // a metered/external provider). Default is 'always'.
      const mode = settings.analyzeMode || 'always';
      if (mode === 'on_change' && !anyChanged) {
        skipped++;
        emit('zone_skipped', { cycleNum, zoneName, reason: 'no_change' });
        continue;
      }
      console.log(`[AutoPoll] "${zoneName}": analyzing ${crops.length} cameras (${crops.filter(c => c.changed).length} changed, mode=${mode})...`);
      const analyses = [];

      for (const { cam, jpegBuffer, error } of crops) {
        if (error || !jpegBuffer) {
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
          continue;
        }
        liveState = { cycleNum, currentZone: zoneName, currentCamera: cam.camName, phase: 'analyzing' };
        emit('camera_call', { cycleNum, zoneName, camId: cam.camId, camName: cam.camName });
        const callStart = Date.now();
        try {
          const result = await analyzeZoneImage(jpegBuffer, zoneName, entry.type, {
            rect: cam.rect,
            resolution: cam.resolution,
          });
          analyses.push({ camId: cam.camId, camName: cam.camName, ...result });
          stats.apiCalls++;
          const latencyMs = Date.now() - callStart;
          console.log(`[AutoPoll]   ${cam.camName}: ${result.occupied ? 'OCCUPIED' : 'FREE'} [${result.confidence}]`);
          emit('camera_result', {
            cycleNum, zoneName, camId: cam.camId, camName: cam.camName,
            occupied: !!result.occupied,
            status: result.occupied ? 'occupied' : 'free',
            confidence: result.confidence,
            vehicle: result.vehicle || null,
            plate: result.plate || null,
            worksInProgress: !!result.worksInProgress,
            peopleCount: result.peopleCount || 0,
            openParts: result.openParts || [],
            description: result.description || '',
            latencyMs,
          });
        } catch (err) {
          console.error(`[AutoPoll]   ${cam.camName}: Vision ERROR — ${err.message}`);
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
          emit('camera_error', {
            cycleNum, zoneName, camId: cam.camId, camName: cam.camName,
            error: err.message, latencyMs: Date.now() - callStart,
          });
        }
      }

      const m = mergeAnalyses(analyses);
      if (!m) {
        // every camera errored — don't overwrite previous good zone state
        console.log(`[AutoPoll] "${zoneName}": all analyses failed, skipping enqueue`);
        continue;
      }

      enqueue({ zoneName, zoneType: entry.type, mergedResult: m.merged, timestamp: new Date().toISOString() });
      results.push({ zoneName, status: m.status, occupiedCount: m.occupiedCount, freeCount: m.freeCount });
      console.log(`[AutoPoll] "${zoneName}": ${m.status} → queued`);
      emit('zone_result', {
        cycleNum, zoneName, zoneType: entry.type,
        status: m.status, mergedResult: m.merged,
        camerasOccupied: m.occupiedCount, camerasFree: m.freeCount,
      });
    }
  }

  nudge();
  lastRun = new Date().toISOString();
  stats.cyclesTotal++;
  stats.zonesAnalyzed += results.length;
  stats.zonesSkipped += skipped;
  stats.lastCycleDuration = Date.now() - startTime;
  liveState = { cycleNum, currentZone: null, currentCamera: null, phase: 'idle' };

  console.log(`[AutoPoll] Cycle #${stats.cyclesTotal}: ${results.length} analyzed, ${skipped} skipped (no change), ${stats.apiCalls} total API calls, ${Math.round(stats.lastCycleDuration / 1000)}s`);
  emit('cycle_end', {
    cycleNum, durationMs: stats.lastCycleDuration,
    analyzed: results.length, skipped, apiCalls: stats.apiCalls,
  });
  return { ok: true, zonesProcessed: results.length, skipped, results, durationMs: stats.lastCycleDuration };
}

function startAutoPoll(ms, threshold) {
  if (running) stopAutoPoll();
  intervalMs = ms || 60000;
  if (threshold !== undefined) changeThreshold = threshold;
  running = true;
  console.log(`[AutoPoll] Started (interval: ${intervalMs / 1000}s, change threshold: ${changeThreshold}%)`);
  emit('autopoll_started', { intervalMs, changeThreshold });

  currentCycle = runOnce().catch(err => console.error('[AutoPoll] Error:', err.message)).finally(() => { currentCycle = null; });

  pollTimer = setInterval(() => {
    if (currentCycle) {
      console.log('[AutoPoll] Previous cycle still running, skipping');
      emit('cycle_skipped', { reason: 'previous_still_running' });
      return;
    }
    currentCycle = runOnce()
      .catch(err => console.error('[AutoPoll] Error:', err.message))
      .finally(() => { currentCycle = null; });
  }, intervalMs);
}

function stopAutoPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  running = false;
  currentCycle = null;
  console.log('[AutoPoll] Stopped');
  emit('autopoll_stopped', {});
}

function isRunning() { return running; }
function getLastRun() { return lastRun; }
function getInterval() { return intervalMs; }
function getStats() { return { ...stats, running, intervalMs, changeThreshold, lastRun }; }
function getRecentEvents(limit) { return limit ? recent.slice(-limit) : recent.slice(); }
function getLiveState() { return { ...liveState, running, intervalMs, lastRun }; }

module.exports = {
  startAutoPoll, stopAutoPoll, isRunning, getLastRun, getInterval, getStats, runOnce,
  // Live observer API
  bus, getRecentEvents, getLiveState, getLastCrop,
};
