/**
 * Server-side motion detection service.
 * Uses FFmpeg to extract raw frames from RTSP at configurable intervals,
 * compares pixel data in defined zones, emits events via SSE.
 *
 * Runs on port 8182, separate from streaming server (8181).
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8182;
const ffmpegPath = path.join(__dirname, 'node_modules/ffmpeg-static/ffmpeg');

// Camera RTSP URLs (same as main server)
const CAMERAS = {
  cam01: { name: 'CAM 01 — 3.5 СТО',       rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/t8rFCkD7_m/' },
  cam02: { name: 'CAM 02 — 3.11 СТО',       rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/w9fKX1CE_m/' },
  cam03: { name: 'CAM 03 — 3.9 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/RTHaqqOJ_m/' },
  cam04: { name: 'CAM 04 — 3.10 СТО',       rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/Mn1PZPF0_m/' },
  cam05: { name: 'CAM 05 — 3.4 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/NQ5s26a6_m/' },
  cam06: { name: 'CAM 06 — 3.6 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/AAIy5dnR_m/' },
  cam07: { name: 'CAM 07 — 3.2 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/k0HNWQDk_m/' },
  cam08: { name: 'CAM 08 — 3.3 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/KRoX0tGZ_m/' },
  cam09: { name: 'CAM 09 — 3.1 СТО',        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/we4rvi8t_m/' },
  cam10: { name: 'CAM 10 — 3.7 Склад СТО',  rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/PxPU26jt_m/' },
};

// Active detectors: camId -> { ffmpeg, config, prevFrame, events[] }
const detectors = {};

// SSE clients
const sseClients = new Set();

// Broadcast event to all SSE clients
function broadcastEvent(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

/**
 * Start motion detection for a camera.
 * config: {
 *   frameInterval: seconds between frames (default 5),
 *   width: analysis width (default 320, downscaled for performance),
 *   height: analysis height (default 180),
 *   threshold: pixel diff threshold 0-255 (default 25),
 *   motionPercent: % of changed pixels to trigger (default 1.5),
 *   zones: [{ zoneId, zoneName, color, rect: { x, y, w, h } }] — in original resolution
 *   resolution: { width, height } — original camera resolution
 * }
 */
function startDetection(camId, config) {
  if (detectors[camId]) stopDetection(camId);

  const cam = CAMERAS[camId];
  if (!cam) return false;

  const cfg = {
    frameInterval: config.frameInterval || 5,
    width: config.width || 320,
    height: config.height || 180,
    threshold: config.threshold || 25,
    motionPercent: config.motionPercent || 1.5,
    zones: config.zones || [],
    resolution: config.resolution || { width: 1920, height: 1080 },
  };

  // Scale zone rects from original resolution to analysis resolution
  const scaleX = cfg.width / cfg.resolution.width;
  const scaleY = cfg.height / cfg.resolution.height;
  const scaledZones = cfg.zones.map(z => ({
    ...z,
    scaledRect: {
      x: Math.round(z.rect.x * scaleX),
      y: Math.round(z.rect.y * scaleY),
      w: Math.round(z.rect.w * scaleX),
      h: Math.round(z.rect.h * scaleY),
    }
  }));

  const frameSize = cfg.width * cfg.height * 3; // RGB24
  const fps = 1 / cfg.frameInterval;

  // FFmpeg: extract raw RGB frames at low fps, downscaled
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', cam.rtspUrl,
    '-vf', `fps=${fps},scale=${cfg.width}:${cfg.height}`,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    '-an',
    'pipe:1'
  ];

  console.log(`[Motion] Starting detection for ${camId} (1 frame every ${cfg.frameInterval}s, ${cfg.width}x${cfg.height})`);

  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = Buffer.alloc(0);

  const detector = {
    ffmpeg,
    config: cfg,
    scaledZones,
    prevFrame: null,
    events: [],
    lastTrigger: {}, // zoneId -> timestamp
    startedAt: Date.now(),
  };

  ffmpeg.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Process complete frames
    while (buffer.length >= frameSize) {
      const frame = buffer.subarray(0, frameSize);
      buffer = buffer.subarray(frameSize);
      processFrame(camId, detector, frame);
    }
  });

  ffmpeg.stderr.on('data', (chunk) => {
    // Suppress FFmpeg logs unless error
    const msg = chunk.toString();
    if (msg.includes('error') || msg.includes('Error')) {
      console.error(`[Motion][${camId}] FFmpeg: ${msg.trim().slice(-200)}`);
    }
  });

  ffmpeg.on('close', (code) => {
    console.log(`[Motion][${camId}] FFmpeg exited with code ${code}`);
    if (detectors[camId] === detector) {
      // Auto-restart after 5s if not manually stopped
      setTimeout(() => {
        if (detectors[camId] === detector) {
          console.log(`[Motion][${camId}] Auto-restarting...`);
          startDetection(camId, config);
        }
      }, 5000);
    }
  });

  ffmpeg.on('error', (err) => {
    console.error(`[Motion][${camId}] FFmpeg spawn error:`, err.message);
  });

  detectors[camId] = detector;
  return true;
}

function processFrame(camId, detector, frame) {
  const { scaledZones, config } = detector;

  if (!detector.prevFrame) {
    detector.prevFrame = Buffer.from(frame);
    return;
  }

  const prev = detector.prevFrame;
  const curr = frame;
  const w = config.width;
  const cooldownMs = config.frameInterval * 1000 * 2; // 2x frame interval cooldown

  for (const zone of scaledZones) {
    const { x, y, w: zw, h: zh } = zone.scaledRect;
    if (zw <= 0 || zh <= 0) continue;

    let changedPixels = 0;
    let totalPixels = 0;

    // Compare pixels in the zone area
    for (let row = y; row < y + zh && row < config.height; row++) {
      for (let col = x; col < x + zw && col < w; col++) {
        const idx = (row * w + col) * 3;
        const dr = Math.abs(curr[idx] - prev[idx]);
        const dg = Math.abs(curr[idx + 1] - prev[idx + 1]);
        const db = Math.abs(curr[idx + 2] - prev[idx + 2]);
        const diff = (dr + dg + db) / 3;
        totalPixels++;
        if (diff > config.threshold) changedPixels++;
      }
    }

    const pct = totalPixels > 0 ? (changedPixels / totalPixels) * 100 : 0;

    if (pct > config.motionPercent) {
      const now = Date.now();
      const lastTrigger = detector.lastTrigger[zone.zoneId] || 0;
      if (now - lastTrigger < cooldownMs) continue;

      detector.lastTrigger[zone.zoneId] = now;

      const event = {
        id: `${now}_${zone.zoneId}`,
        camId,
        camName: CAMERAS[camId]?.name || camId,
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        type: 'motion',
        intensity: Math.round(pct * 10) / 10,
        time: new Date().toISOString(),
        timeLocal: new Date().toLocaleTimeString('ru-RU'),
      };

      // Keep last 200 events per camera
      detector.events.push(event);
      if (detector.events.length > 200) detector.events.shift();

      console.log(`[Motion][${camId}] ${zone.zoneName}: motion ${pct.toFixed(1)}%`);
      broadcastEvent(event);
    }
  }

  detector.prevFrame = Buffer.from(frame);
}

function stopDetection(camId) {
  const det = detectors[camId];
  if (!det) return false;

  if (det.ffmpeg) {
    det.ffmpeg.kill('SIGTERM');
  }
  delete detectors[camId];
  console.log(`[Motion] Stopped detection for ${camId}`);
  return true;
}

// --- HTTP Server ---
function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  // POST /api/motion/start/:camId
  const startMatch = url.match(/^\/api\/motion\/start\/(\w+)$/);
  if (startMatch && req.method === 'POST') {
    const camId = startMatch[1];
    if (!CAMERAS[camId]) return jsonResponse(res, 404, { error: 'Camera not found' });
    const config = await parseBody(req);
    const ok = startDetection(camId, config);
    return jsonResponse(res, 200, { status: ok ? 'started' : 'failed', camId });
  }

  // POST /api/motion/stop/:camId
  const stopMatch = url.match(/^\/api\/motion\/stop\/(\w+)$/);
  if (stopMatch && req.method === 'POST') {
    const camId = stopMatch[1];
    stopDetection(camId);
    return jsonResponse(res, 200, { status: 'stopped', camId });
  }

  // GET /api/motion/status
  if (url === '/api/motion/status') {
    const status = {};
    for (const [id, cam] of Object.entries(CAMERAS)) {
      const det = detectors[id];
      status[id] = {
        name: cam.name,
        active: !!det,
        eventsCount: det ? det.events.length : 0,
        config: det ? {
          frameInterval: det.config.frameInterval,
          zonesCount: det.scaledZones.length,
        } : null,
      };
    }
    return jsonResponse(res, 200, status);
  }

  // GET /api/motion/events/:camId
  const eventsMatch = url.match(/^\/api\/motion\/events\/(\w+)$/);
  if (eventsMatch && req.method === 'GET') {
    const camId = eventsMatch[1];
    const det = detectors[camId];
    return jsonResponse(res, 200, det ? det.events : []);
  }

  // GET /api/motion/events — SSE stream for all events
  if (url === '/api/motion/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // PUT /api/motion/config/:camId — update config (restart detection)
  const configMatch = url.match(/^\/api\/motion\/config\/(\w+)$/);
  if (configMatch && req.method === 'PUT') {
    const camId = configMatch[1];
    if (!CAMERAS[camId]) return jsonResponse(res, 404, { error: 'Camera not found' });
    const config = await parseBody(req);
    const det = detectors[camId];
    if (det) {
      // Restart with new config
      startDetection(camId, config);
      return jsonResponse(res, 200, { status: 'updated', camId });
    }
    return jsonResponse(res, 200, { status: 'not_running', camId });
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Motion] Detection server running on http://0.0.0.0:${PORT}`);
});
