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
const { startWorker } = require('./lib/dbWorker');
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
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json({
    anthropicApiKey: settings.anthropicApiKey ? '****' + settings.anthropicApiKey.slice(-8) : '',
    visionModel: settings.visionModel || 'claude-sonnet-4-20250514',
    configured: !!settings.anthropicApiKey,
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
  res.json({ ok: true, running: true, intervalMs });
});

app.post('/api/autopoll/stop', (req, res) => {
  autoPoll.stopAutoPoll();
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zone Mapper API running on http://0.0.0.0:${PORT}`);
  // Start DB worker
  startWorker(500);
});
