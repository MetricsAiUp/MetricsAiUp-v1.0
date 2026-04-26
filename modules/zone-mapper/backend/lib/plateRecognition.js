/**
 * ANPR (Automatic Number Plate Recognition) client via RabbitMQ.
 * Connects to GPU service on 10.12.0.7 (nomeroff-net v4, RTX 3070).
 *
 * Architecture: shared input queue, per-app response queue.
 * Sends JPEG → receives { plates: [{ text, confidence, bbox }] }
 */

const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://sto_service:Sto%24Plate2026%21@10.12.0.7:5672';
const REQUEST_QUEUE = 'plate_recognition_requests';
const APP_ID = 'sto_plate_reader';
const RESPONSE_QUEUE = `plate_results_${APP_ID}`;
const DEFAULT_TIMEOUT = 45000; // 45s (processing takes 2-16s, queue wait possible)

let connection = null;
let channel = null;
let connecting = false;
let lastConnectAttempt = 0;
const RECONNECT_BACKOFF_MS = 5000;
let pendingRequests = new Map(); // frameId → { resolve, reject, timer }

async function ensureConnection() {
  if (channel && connection) return;

  const sinceLast = Date.now() - lastConnectAttempt;
  if (!connecting && sinceLast < RECONNECT_BACKOFF_MS && lastConnectAttempt > 0) {
    throw new Error(`ANPR reconnect throttled (last attempt ${sinceLast}ms ago)`);
  }

  if (connecting) {
    for (let i = 0; i < 50 && connecting; i++) await new Promise(r => setTimeout(r, 100));
    if (channel && connection) return;
  }

  connecting = true;
  lastConnectAttempt = Date.now();
  try {
    connection = await amqp.connect(RABBITMQ_URL, { heartbeat: 60 });
    channel = await connection.createChannel();

    await channel.assertQueue(REQUEST_QUEUE, { durable: true });
    await channel.assertQueue(RESPONSE_QUEUE, { durable: true });

    // Consume response queue
    channel.consume(RESPONSE_QUEUE, (msg) => {
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
        console.error('[ANPR] Failed to parse response:', err.message);
      }
      try { channel && channel.ack(msg); } catch {}
    });

    connection.on('error', (err) => {
      console.error('[ANPR] Connection error:', err.message);
      cleanup();
    });
    connection.on('close', (err) => {
      console.warn('[ANPR] Connection closed' + (err ? `: ${err.message}` : ''));
      cleanup();
    });
    // Channel-level errors (e.g. precondition-failed, server-side close) MUST
    // be handled — otherwise amqplib emits unhandled 'error' and Node exits.
    channel.on('error', (err) => {
      console.error('[ANPR] Channel error:', err.message);
      cleanup();
    });
    channel.on('close', () => {
      console.warn('[ANPR] Channel closed');
      cleanup();
    });

    console.log('[ANPR] Connected to RabbitMQ at 10.12.0.7');
  } catch (err) {
    console.error('[ANPR] Connection failed:', err.message);
    cleanup();
    throw err;
  } finally {
    connecting = false;
  }
}

function cleanup() {
  if (connection) { try { connection.removeAllListeners(); } catch {} }
  if (channel)    { try { channel.removeAllListeners(); }    catch {} }
  channel = null;
  connection = null;
  // Reject all pending requests
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('ANPR connection lost'));
  }
  pendingRequests.clear();
}

/**
 * Send a JPEG image for plate recognition.
 * @param {Buffer} jpegBuffer - JPEG image buffer
 * @param {string} [frameId] - optional unique ID for tracking
 * @param {number} [timeout] - timeout in ms (default 30s)
 * @returns {Promise<{ plates: Array<{ text, confidence, bbox }>, processing_time_ms }>}
 */
async function recognizePlate(jpegBuffer, frameId, timeout) {
  await ensureConnection();

  const fid = frameId || `zm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timeoutMs = timeout || DEFAULT_TIMEOUT;

  const message = {
    frame_id: fid,
    app_id: APP_ID,
    image_base64: jpegBuffer.toString('base64'),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(fid);
      reject(new Error(`ANPR timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    pendingRequests.set(fid, { resolve, reject, timer });

    try {
      if (!channel) throw new Error('ANPR channel not available');
      channel.sendToQueue(
        REQUEST_QUEUE,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(fid);
      cleanup();
      reject(new Error(`ANPR send failed: ${err.message}`));
    }
  });
}

/**
 * Normalize plate text to standard BY/RU format.
 * Belarus: "4321AB7" → "4321 AB-7" (4 digits + 2 letters + dash + region digit)
 * Russia: "A123BC77" → "А123ВС77" (letter + 3 digits + 2 letters + region 2-3 digits)
 */
function normalizePlate(raw) {
  if (!raw) return null;
  const s = raw.replace(/[\s\-]/g, '').toUpperCase();

  // Belarus pattern: 4 digits + 2 letters + 1 region digit (e.g. 9368XT7)
  const byMatch = s.match(/^(\d{4})([A-ZА-Я]{2})(\d)$/);
  if (byMatch) {
    return `${byMatch[1]} ${byMatch[2]}-${byMatch[3]}`;
  }

  // Belarus pattern variation: might have extra chars, try to extract
  // e.g. "39B9HB7" — could be misread, but try 4dig+2let+1dig within
  const byLoose = s.match(/^(\d{4})([A-ZА-Я]{1,2})(\d)$/);
  if (byLoose && byLoose[2].length >= 1) {
    return `${byLoose[1]} ${byLoose[2]}-${byLoose[3]}`;
  }

  // Russia pattern: 1 letter + 3 digits + 2 letters + 2-3 digit region
  const ruMatch = s.match(/^([A-ZА-Я])(\d{3})([A-ZА-Я]{2})(\d{2,3})$/);
  if (ruMatch) {
    return `${ruMatch[1]}${ruMatch[2]}${ruMatch[3]}${ruMatch[4]}`;
  }

  // Return cleaned up but unformatted if no pattern matched
  return s;
}

/**
 * Recognize plate and return the best result as a simple string.
 * @param {Buffer} jpegBuffer
 * @param {number} [timeout]
 * @returns {Promise<{ plate: string|null, confidence: number, processingMs: number }>}
 */
async function recognizePlateBest(jpegBuffer, timeout) {
  const result = await recognizePlate(jpegBuffer, undefined, timeout);

  if (result.error) {
    return { plate: null, confidence: 0, processingMs: result.processing_time_ms || 0, allPlates: [] };
  }

  if (!result.plates || result.plates.length === 0) {
    return { plate: null, confidence: 0, processingMs: result.processing_time_ms || 0, allPlates: [] };
  }

  // Filter: only valid BY/RU plate formats
  // BY: 4 digits + 2 letters + 1 region digit = 7 chars (e.g. 9368XT7)
  // RU: 1 letter + 3 digits + 2 letters + 2-3 region digits = 8-9 chars (e.g. A123BC77)
  const valid = result.plates.filter(p => {
    if (!p.text || p.text.length < 6) return false;
    const s = p.text.replace(/[\s\-]/g, '').toUpperCase();
    // BY format: 4digits + 2letters + 1digit
    if (/^\d{4}[A-ZА-Я]{2}\d$/.test(s)) return true;
    // RU format: 1letter + 3digits + 2letters + 2-3 region digits
    if (/^[A-ZА-Я]\d{3}[A-ZА-Я]{2}\d{2,3}$/.test(s)) return true;
    return false;
  });

  if (valid.length === 0) {
    return { plate: null, confidence: 0, processingMs: result.processing_time_ms || 0, allPlates: result.plates };
  }

  // Pick the longest plate (real BY/RU plates are longest), then by confidence
  const best = valid.sort((a, b) => {
    const lenDiff = (b.text?.length || 0) - (a.text?.length || 0);
    if (lenDiff !== 0) return lenDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  })[0];

  const normalized = normalizePlate(best.text);

  return {
    plate: normalized || best.text || null,
    plateRaw: best.text || null,
    confidence: best.confidence || 0,
    processingMs: result.processing_time_ms || 0,
    allPlates: result.plates,
  };
}

/**
 * Check if ANPR service is reachable.
 */
async function isAvailable() {
  try {
    await ensureConnection();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close connection.
 */
async function disconnect() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {}
  cleanup();
}

module.exports = { recognizePlate, recognizePlateBest, isAvailable, disconnect, normalizePlate };
