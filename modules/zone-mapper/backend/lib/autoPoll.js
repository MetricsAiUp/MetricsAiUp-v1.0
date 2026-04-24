const http = require('http');
const crypto = require('crypto');
const { read } = require('./storage');
const { analyzeZoneImage, loadSettings } = require('./vision');
const { enqueue } = require('./monitoringDb');
const { nudge } = require('./dbWorker');

let pollTimer = null;
let running = false;
let lastRun = null;
let currentCycle = null;
let intervalMs = 60000;
let changeThreshold = 5; // % of pixels changed to trigger analysis
let stats = { cyclesTotal: 0, zonesAnalyzed: 0, zonesSkipped: 0, lastCycleDuration: 0, apiCalls: 0 };

// Previous frame hashes per zone for change detection
const prevFrames = {}; // key: `${camId}_${zoneName}` → { buffer, hash }

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

function fetchCrop(camId, rect, resolution) {
  const { x, y, w, h } = rect;
  const fw = resolution?.width || 1920;
  const fh = resolution?.height || 1080;
  return httpGet(`${CAMERA_SERVER}/api/stream/snapshot/${camId}/crop?x=${x}&y=${y}&w=${w}&h=${h}&fw=${fw}&fh=${fh}`);
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

      // Step 1: Fetch crops from all cameras and check for changes
      let anyChanged = false;
      const crops = [];

      for (const cam of entry.cameras) {
        try {
          const jpegBuffer = await fetchCrop(cam.camId, cam.rect, cam.resolution);
          const key = `${cam.camId}_${zoneName}`;
          const changed = hasContentChanged(key, jpegBuffer);
          crops.push({ cam, jpegBuffer, changed });
          if (changed) anyChanged = true;
        } catch (err) {
          console.error(`[AutoPoll] ${cam.camName} crop error for "${zoneName}": ${err.message}`);
          crops.push({ cam, jpegBuffer: null, changed: false, error: true });
        }
      }

      // Step 2: If nothing changed in any camera view — skip Claude analysis
      if (!anyChanged) {
        skipped++;
        continue;
      }

      console.log(`[AutoPoll] "${zoneName}": change detected, analyzing (${crops.filter(c => c.changed).length}/${crops.length} cameras changed)...`);
      const analyses = [];

      for (const { cam, jpegBuffer, error } of crops) {
        if (error || !jpegBuffer) {
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
          continue;
        }
        try {
          const result = await analyzeZoneImage(jpegBuffer, zoneName, entry.type);
          analyses.push({ camId: cam.camId, camName: cam.camName, ...result });
          stats.apiCalls++;
          console.log(`[AutoPoll]   ${cam.camName}: ${result.occupied ? 'OCCUPIED' : 'FREE'} [${result.confidence}]`);
        } catch (err) {
          console.error(`[AutoPoll]   ${cam.camName}: Vision ERROR — ${err.message}`);
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
        }
      }

      const valid = analyses.filter(a => !a.error);
      const occupiedCount = valid.filter(a => a.occupied).length;
      const freeCount = valid.filter(a => !a.occupied).length;
      const status = occupiedCount > freeCount ? 'occupied' : 'free';

      const best = valid.sort((a, b) => {
        const co = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (co[b.confidence] || 0) - (co[a.confidence] || 0);
      })[0] || {};

      const mergedResult = {
        status, occupied: status === 'occupied',
        vehicle: best.vehicle || null, plate: best.plate || null,
        openParts: best.openParts || [], worksInProgress: !!best.worksInProgress,
        worksDescription: best.worksDescription || null, peopleCount: best.peopleCount || 0,
        confidence: best.confidence || 'LOW', description: best.description || '',
        camerasAnalyzed: analyses.length, camerasOccupied: occupiedCount, camerasFree: freeCount,
      };

      enqueue({ zoneName, zoneType: entry.type, mergedResult, timestamp: new Date().toISOString() });
      results.push({ zoneName, status, occupiedCount, freeCount });
      console.log(`[AutoPoll] "${zoneName}": ${status} → queued`);
    }
  }

  nudge();
  lastRun = new Date().toISOString();
  stats.cyclesTotal++;
  stats.zonesAnalyzed += results.length;
  stats.zonesSkipped += skipped;
  stats.lastCycleDuration = Date.now() - startTime;

  console.log(`[AutoPoll] Cycle #${stats.cyclesTotal}: ${results.length} analyzed, ${skipped} skipped (no change), ${stats.apiCalls} total API calls, ${Math.round(stats.lastCycleDuration / 1000)}s`);
  return { ok: true, zonesProcessed: results.length, skipped, results, durationMs: stats.lastCycleDuration };
}

function startAutoPoll(ms, threshold) {
  if (running) stopAutoPoll();
  intervalMs = ms || 60000;
  if (threshold !== undefined) changeThreshold = threshold;
  running = true;
  console.log(`[AutoPoll] Started (interval: ${intervalMs / 1000}s, change threshold: ${changeThreshold}%)`);

  currentCycle = runOnce().catch(err => console.error('[AutoPoll] Error:', err.message)).finally(() => { currentCycle = null; });

  pollTimer = setInterval(() => {
    if (currentCycle) {
      console.log('[AutoPoll] Previous cycle still running, skipping');
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
}

function isRunning() { return running; }
function getLastRun() { return lastRun; }
function getInterval() { return intervalMs; }
function getStats() { return { ...stats, running, intervalMs, changeThreshold, lastRun }; }

module.exports = { startAutoPoll, stopAutoPoll, isRunning, getLastRun, getInterval, getStats, runOnce };
