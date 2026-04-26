const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const roomsRouter = require('./routes/rooms');
const zonesRouter = require('./routes/zones');
const camerasRouter = require('./routes/cameras');
const collectorRouter = require('./routes/collector');
const monitoringRouter = require('./routes/monitoring');
const { analyzeZoneImage, loadSettings, saveSettings } = require('./lib/vision');
const { DEFAULTS: ANPR_DEFAULTS } = require('./lib/plateRecognitionV2');
const { startWorker } = require('./lib/dbWorker');
const { getFullState } = require('./lib/monitoringDb');
const autoPoll = require('./lib/autoPoll');

const app = express();
const PORT = process.env.PORT || 3100;
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api/rooms', roomsRouter);
app.use('/api/rooms/:roomId/zones', zonesRouter);
app.use('/api/rooms/:roomId/cameras', camerasRouter);
app.use('/api/collector', collectorRouter);
app.use('/api/monitoring', monitoringRouter);

// Settings API
//
// Provider toggle: settings.visionProvider
//   'v2'     → ANPR-RTX3070 service over RabbitMQ (default)
//   'claude' → Anthropic Vision (legacy)
// ANPR connection (host / port / user / password / queue / app id) is in
// settings.json as anpr* fields; missing fields fall back to ANPR_DEFAULTS
// pulled from plateRecognitionV2 (current production values).
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json({
    anthropicApiKey: settings.anthropicApiKey ? '****' + settings.anthropicApiKey.slice(-8) : '',
    visionModel: settings.visionModel || 'claude-sonnet-4-20250514',
    visionProvider: settings.visionProvider || 'v2',
    analyzeMode: settings.analyzeMode || 'always',
    configured: !!settings.anthropicApiKey,
    // ANPR-RTX3070 connection — password masked like the API key.
    anprHost: settings.anprHost || ANPR_DEFAULTS.anprHost,
    anprPort: settings.anprPort || ANPR_DEFAULTS.anprPort,
    anprUser: settings.anprUser || ANPR_DEFAULTS.anprUser,
    anprPassword: (settings.anprPassword || ANPR_DEFAULTS.anprPassword)
      ? '****' + (settings.anprPassword || ANPR_DEFAULTS.anprPassword).slice(-4)
      : '',
    anprRequestQueue: settings.anprRequestQueue || ANPR_DEFAULTS.anprRequestQueue,
    anprAppId: settings.anprAppId || ANPR_DEFAULTS.anprAppId,
  });
});

app.put('/api/settings', (req, res) => {
  const settings = loadSettings();
  if (req.body.anthropicApiKey !== undefined) {
    if (!req.body.anthropicApiKey.startsWith('****')) {
      settings.anthropicApiKey = req.body.anthropicApiKey;
    }
  }
  if (req.body.visionModel) settings.visionModel = req.body.visionModel;
  if (req.body.visionProvider === 'v2' || req.body.visionProvider === 'claude') {
    settings.visionProvider = req.body.visionProvider;
  }
  if (req.body.analyzeMode === 'always' || req.body.analyzeMode === 'on_change') {
    settings.analyzeMode = req.body.analyzeMode;
  }
  // ANPR connection fields. Empty strings clear (revert to defaults). Masked
  // password (starts with '****') is ignored so the existing value is kept.
  if (req.body.anprHost !== undefined) settings.anprHost = req.body.anprHost || undefined;
  if (req.body.anprPort !== undefined) {
    const p = Number(req.body.anprPort);
    settings.anprPort = Number.isFinite(p) && p > 0 ? p : undefined;
  }
  if (req.body.anprUser !== undefined) settings.anprUser = req.body.anprUser || undefined;
  if (req.body.anprPassword !== undefined && !String(req.body.anprPassword).startsWith('****')) {
    settings.anprPassword = req.body.anprPassword || undefined;
  }
  if (req.body.anprRequestQueue !== undefined) settings.anprRequestQueue = req.body.anprRequestQueue || undefined;
  if (req.body.anprAppId !== undefined) settings.anprAppId = req.body.anprAppId || undefined;

  saveSettings(settings);
  res.json({ ok: true, configured: !!settings.anthropicApiKey });
});

// Vision analysis API
app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64, zoneName, zoneType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
    const buffer = Buffer.from(imageBase64, 'base64');
    const result = await analyzeZoneImage(buffer, zoneName || 'Zone', zoneType || 'lift');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-poll control
app.post('/api/autopoll/start', (req, res) => {
  const intervalMs = req.body.intervalMs || 60000;
  const changeThreshold = req.body.changeThreshold;
  autoPoll.startAutoPoll(intervalMs, changeThreshold);
  // Persist so backend restarts pick up where we left off.
  const s = loadSettings();
  s.autopollEnabled = true;
  s.autopollIntervalMs = intervalMs;
  if (changeThreshold !== undefined) s.autopollChangeThreshold = changeThreshold;
  saveSettings(s);
  res.json({ ok: true, running: true, intervalMs });
});

app.post('/api/autopoll/stop', (req, res) => {
  autoPoll.stopAutoPoll();
  const s = loadSettings();
  s.autopollEnabled = false;
  saveSettings(s);
  res.json({ ok: true, running: false });
});

app.get('/api/autopoll/status', (req, res) => {
  res.json(autoPoll.getStats());
});

app.post('/api/autopoll/once', async (req, res) => {
  try {
    const result = await autoPoll.runOnce();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Snapshot for a freshly opened observer page — gives current live state,
// stats, full per-zone DB state (so the page can render zones immediately
// without waiting for the next cycle), and recent event tail.
app.get('/api/autopoll/state', (req, res) => {
  try {
    res.json({
      liveState: autoPoll.getLiveState(),
      stats: autoPoll.getStats(),
      zones: getFullState(),
      recentEvents: autoPoll.getRecentEvents(50),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Latest crop bytes from the most recent server-side cycle, per (zone, camera).
// Lets the observer page render the SAME image the server just analyzed,
// without re-hitting the camera proxy and creating a parallel fetch stream.
app.get('/api/autopoll/crop', (req, res) => {
  const zone = String(req.query.zone || '');
  const camId = String(req.query.camId || '');
  if (!zone || !camId) return res.status(400).send('zone & camId required');
  const c = autoPoll.getLastCrop(zone, camId);
  if (!c) return res.status(404).send('no crop yet');
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.send(c.jpeg);
});

// SSE event stream — page subscribes once on mount and receives every
// lifecycle event (cycle_start, zone_start, camera_call, zone_result, ...).
// Replays last 50 events on connect so reconnects don't lose context.
app.get('/api/autopoll/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    // Disable proxy buffering (nginx) — without this, events queue up and
    // the page only updates in bursts.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch {}
  };

  // Replay tail so a fresh client immediately sees recent activity.
  for (const ev of autoPoll.getRecentEvents(50)) send(ev);

  const listener = (ev) => send(ev);
  autoPoll.bus.on('event', listener);

  // Heartbeat — keeps proxies + browsers from closing an idle connection
  // during long pauses between cycles.
  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    autoPoll.bus.off('event', listener);
  });
});

// Serve API documentation
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-docs.yaml'));
});
app.get('/api/docs/cameras', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-docs-cameras.yaml'));
});

// Port-aware HTML rewriting for proxy
app.use((req, res, next) => {
  const portParam = req.query.port;
  if (!portParam) return next();
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(frontendDist, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/(\.\/assets\/[^"]+)"/g, `$1?port=${portParam}"`);
  res.type('html').send(html);
});

app.use(express.static(frontendDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Process-level safety nets — prevent unhandled events from killing the
// whole backend. Connection drops to the v2 service are normal and recover
// on next request via the per-client reconnect logic.
process.on('uncaughtException', (err) => {
  console.error('[Server] uncaughtException:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] unhandledRejection:', reason && reason.message ? reason.message : reason);
});

// Graceful shutdown so the supervisor can restart us cleanly.
function shutdown(signal) {
  console.log(`[Server] ${signal} received, shutting down...`);
  try { autoPoll.stopAutoPoll(); } catch {}
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zone Mapper API running on http://0.0.0.0:${PORT}`);
  // Start DB worker
  startWorker(500);

  // Auto-resume autopoll if it was running before last shutdown/crash.
  // Lets supervisor restart fully restore service without manual button-press.
  const s = loadSettings();
  if (s.autopollEnabled) {
    const interval = s.autopollIntervalMs || 60000;
    const threshold = s.autopollChangeThreshold;
    console.log(`[Server] Auto-resuming autopoll (interval=${interval}ms)`);
    autoPoll.startAutoPoll(interval, threshold);
  }
});
