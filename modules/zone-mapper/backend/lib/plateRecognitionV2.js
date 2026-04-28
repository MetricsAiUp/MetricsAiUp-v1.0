/**
 * ANPR v2 client via RabbitMQ — plates + per-zone occupancy/body/color/brand.
 * Replaces Claude Vision for zone analysis. Old plateRecognition.js stays.
 *
 * Request:  { frame_id, app_id, image_base64, zones:[{zone_id,bbox:[x1,y1,x2,y2],polygon?:[[x,y],...]}] }
 * Response: { frame_id, app_id, plates:[...], zones:[{zone_id,occupied,occupancy_prob,
 *             body,body_prob,color,color_prob,brand,brand_prob,matched_plate}],
 *             processing_time_ms, error }
 */

const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'settings.json');

// Built-in defaults — used both as fallback when settings.json is missing a
// field, and exported as DEFAULTS for the settings UI.
const DEFAULTS = Object.freeze({
  anprHost: '10.12.0.7',
  anprPort: 5672,
  anprUser: 'sto_service',
  anprPassword: 'Sto$Plate2026!',
  anprRequestQueue: 'plate_recognition_v2_requests',
  anprAppId: 'sto_plate_reader_v2',
});

const DEFAULT_TIMEOUT = 60000; // 60s — v2 does more work than v1

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Compose live config from settings.json with built-in fallbacks.
 * Response queue is always `plate_results_v2_<appId>` (service convention).
 */
function getConfig() {
  const s = readSettings();
  const host = s.anprHost || DEFAULTS.anprHost;
  const port = Number(s.anprPort) || DEFAULTS.anprPort;
  const user = s.anprUser || DEFAULTS.anprUser;
  const password = s.anprPassword || DEFAULTS.anprPassword;
  const requestQueue = s.anprRequestQueue || DEFAULTS.anprRequestQueue;
  const appId = s.anprAppId || DEFAULTS.anprAppId;
  const url = `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
  return {
    url,
    host,
    port,
    requestQueue,
    appId,
    responseQueue: `plate_results_v2_${appId}`,
  };
}

// Track the config the current connection was opened with — if settings change,
// we drop the connection so the next call re-connects with the new params.
let activeConfigKey = null;
function configKey(cfg) {
  return [cfg.url, cfg.requestQueue, cfg.responseQueue].join('|');
}

let connection = null;
let channel = null;
let connecting = false;
let lastConnectAttempt = 0;
const RECONNECT_BACKOFF_MS = 5000; // throttle reconnect attempts
const pendingRequests = new Map(); // frameId → { resolve, reject, timer }

async function ensureConnection() {
  const cfg = getConfig();
  const key = configKey(cfg);

  // Settings changed since last connect — drop the stale connection so we
  // re-open with the new host/credentials/queue.
  if ((channel && connection) && activeConfigKey && activeConfigKey !== key) {
    console.log('[ANPRv2] Settings changed, reconnecting');
    try { await disconnect(); } catch {}
  }

  if (channel && connection) return;

  // Throttle reconnect storms — if last attempt failed recently, fail fast.
  const sinceLast = Date.now() - lastConnectAttempt;
  if (!connecting && sinceLast < RECONNECT_BACKOFF_MS && lastConnectAttempt > 0) {
    throw new Error(`ANPRv2 reconnect throttled (last attempt ${sinceLast}ms ago)`);
  }

  if (connecting) {
    // Another caller is already connecting — wait briefly for them.
    for (let i = 0; i < 50 && connecting; i++) await new Promise(r => setTimeout(r, 100));
    if (channel && connection) return;
  }

  connecting = true;
  lastConnectAttempt = Date.now();
  try {
    connection = await amqp.connect(cfg.url, { heartbeat: 60 });
    channel = await connection.createChannel();

    await channel.assertQueue(cfg.requestQueue, { durable: true });
    await channel.assertQueue(cfg.responseQueue, { durable: true });

    channel.consume(cfg.responseQueue, (msg) => {
      if (!msg) return;
      try {
        const result = JSON.parse(msg.content.toString());
        const pending = pendingRequests.get(result.frame_id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(result.frame_id);
          pending.resolve(result);
        }
      } catch (err) {
        console.error('[ANPRv2] Failed to parse response:', err.message);
      }
      try { channel && channel.ack(msg); } catch {}
    });

    // Connection-level: heartbeat timeout, socket reset, server-side close.
    connection.on('error', (err) => {
      console.error('[ANPRv2] Connection error:', err.message);
      cleanup();
    });
    connection.on('close', (err) => {
      console.warn('[ANPRv2] Connection closed' + (err ? `: ${err.message}` : ''));
      cleanup();
    });

    // Channel-level: server can close a channel without dropping connection
    // (e.g. precondition-failed on declare). Without these handlers,
    // amqplib emits 'error' on channel and Node kills the process.
    channel.on('error', (err) => {
      console.error('[ANPRv2] Channel error:', err.message);
      cleanup();
    });
    channel.on('close', () => {
      console.warn('[ANPRv2] Channel closed');
      cleanup();
    });

    activeConfigKey = key;
    console.log(`[ANPRv2] Connected to RabbitMQ at ${cfg.host}:${cfg.port}`);
  } catch (err) {
    console.error('[ANPRv2] Connection failed:', err.message);
    cleanup();
    throw err;
  } finally {
    connecting = false;
  }
}

function cleanup() {
  // Detach handlers BEFORE nulling refs so a late-firing event on the dead
  // connection doesn't bubble up as Unhandled.
  if (connection) { try { connection.removeAllListeners(); } catch {} }
  if (channel)    { try { channel.removeAllListeners(); }    catch {} }
  channel = null;
  connection = null;
  activeConfigKey = null;
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('ANPRv2 connection lost'));
  }
  pendingRequests.clear();
}

/**
 * Validate a single zone descriptor before sending.
 * Throws on bad shape so callers learn at the boundary, not from a remote error.
 */
function validateZone(z, idx) {
  if (!z || typeof z !== 'object') {
    throw new Error(`zones[${idx}] must be an object`);
  }
  if (z.zone_id === undefined || z.zone_id === null) {
    throw new Error(`zones[${idx}].zone_id is required`);
  }
  if (!Array.isArray(z.bbox) || z.bbox.length !== 4) {
    throw new Error(`zones[${idx}].bbox must be [x1,y1,x2,y2]`);
  }
  const [x1, y1, x2, y2] = z.bbox;
  if (![x1, y1, x2, y2].every(n => Number.isFinite(n))) {
    throw new Error(`zones[${idx}].bbox values must be numbers`);
  }
  if (x1 >= x2 || y1 >= y2 || x1 < 0 || y1 < 0) {
    throw new Error(`zones[${idx}].bbox invalid: [${x1},${y1},${x2},${y2}]`);
  }
  // Optional polygon: ≥3 [x,y] points, finite numbers, in same pixel space as bbox.
  // ANPR side post-filters detections via cv2.pointPolygonTest. Self-intersection
  // is checked there; we only validate shape/types/non-negative coords here.
  if (z.polygon !== undefined && z.polygon !== null) {
    if (!Array.isArray(z.polygon) || z.polygon.length < 3) {
      throw new Error(`zones[${idx}].polygon must be array of ≥3 [x,y] pairs`);
    }
    for (let i = 0; i < z.polygon.length; i++) {
      const p = z.polygon[i];
      if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        throw new Error(`zones[${idx}].polygon[${i}] must be [x,y] of finite numbers`);
      }
      if (p[0] < 0 || p[1] < 0) {
        throw new Error(`zones[${idx}].polygon[${i}] has negative coord: [${p[0]},${p[1]}]`);
      }
    }
  }
}

/**
 * Send full frame + zones for combined plate + occupancy analysis.
 *
 * @param {Buffer} jpegBuffer Full-frame JPEG/PNG (no pre-cropping).
 * @param {Array<{zone_id:string|number, bbox:[number,number,number,number], polygon?:Array<[number,number]>}>} zones
 *        Pixel-space bboxes in the original frame. Empty array = plates-only mode.
 *        Optional `polygon` is a tighter ≥3-pt outline in the same pixel space;
 *        ANPR uses it as a post-filter (cv2.pointPolygonTest) so neighbour cars
 *        sitting inside the bbox but outside the polygon are excluded.
 * @param {object} [opts]
 * @param {string} [opts.frameId] override generated id
 * @param {number} [opts.timeout] ms, default 60000
 *
 * @returns {Promise<{
 *   frame_id: string,
 *   app_id: string,
 *   plates: Array<{ text: string, confidence: number, bbox: [number,number,number,number] }>,
 *   zones: Array<{
 *     zone_id: string|number,
 *     occupied: boolean,
 *     occupancy_prob: number,
 *     // Vehicle attrs (null when zone is free):
 *     body: string|null, body_prob: number|null,
 *     color: string|null, color_prob: number|null,
 *     make: string|null, make_prob: number|null,
 *     // Bonus signals replacing Claude Vision:
 *     works_in_progress: boolean, works_prob: number|null,
 *     people_count: string|number|null, people_prob: number|null,
 *     open_parts: Record<string, { open: boolean, prob: number }>|null,
 *     // Plate matched into this zone (null if no plate landed inside):
 *     matched_plate: string|null,
 *   }>,
 *   processing_time_ms: number,
 *   error: string|null,
 * }>}
 *
 * Note: server uses field name `make` (not `brand` from earlier spec draft).
 * `color` and `make` are documented as low-accuracy hints.
 */
async function recognizeV2(jpegBuffer, zones, opts = {}) {
  if (!Buffer.isBuffer(jpegBuffer)) {
    throw new Error('jpegBuffer must be a Buffer');
  }
  if (!Array.isArray(zones)) {
    throw new Error('zones must be an array (use [] for plates-only)');
  }
  zones.forEach(validateZone);

  await ensureConnection();
  const cfg = getConfig();

  const fid = opts.frameId || `zm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timeoutMs = opts.timeout || DEFAULT_TIMEOUT;

  // Cast bbox values to integers (service expects ints).
  // Polygon, if present, is sent in same pixel space as bbox, also rounded.
  const cleanZones = zones.map(z => {
    const out = {
      zone_id: z.zone_id,
      bbox: z.bbox.map(n => Math.round(n)),
    };
    if (Array.isArray(z.polygon) && z.polygon.length >= 3) {
      out.polygon = z.polygon.map(([x, y]) => [Math.round(x), Math.round(y)]);
    }
    return out;
  });

  const message = {
    frame_id: fid,
    app_id: cfg.appId,
    image_base64: jpegBuffer.toString('base64'),
    zones: cleanZones,
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(fid);
      reject(new Error(`ANPRv2 timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    pendingRequests.set(fid, { resolve, reject, timer });

    try {
      // channel may have been nulled by an event between ensureConnection
      // and now; guard so we reject cleanly instead of crashing.
      if (!channel) throw new Error('ANPRv2 channel not available');
      channel.sendToQueue(
        cfg.requestQueue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(fid);
      cleanup(); // force reconnect on next call
      reject(new Error(`ANPRv2 send failed: ${err.message}`));
    }
  });
}

/**
 * Convenience: index zones[] result by zone_id for O(1) lookup.
 * Caller still has plates[] separately.
 */
function indexZones(result) {
  const map = new Map();
  for (const z of result.zones || []) {
    map.set(z.zone_id, z);
  }
  return map;
}

async function isAvailable() {
  try {
    await ensureConnection();
    return true;
  } catch {
    return false;
  }
}

async function disconnect() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {}
  cleanup();
}

module.exports = {
  recognizeV2,
  indexZones,
  isAvailable,
  disconnect,
  getConfig,
  DEFAULTS,
  // Legacy getters — preserve compatibility with scripts that imported the
  // old constants. Each access reads current settings.
  get APP_ID() { return getConfig().appId; },
  get REQUEST_QUEUE() { return getConfig().requestQueue; },
  get RESPONSE_QUEUE() { return getConfig().responseQueue; },
};
