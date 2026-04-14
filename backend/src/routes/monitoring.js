const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/monitoring/state — full monitoring state (posts + zones)
router.get('/state', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy || !proxy.isRunning()) {
    return res.status(503).json({ error: 'Monitoring proxy not running (switch to live mode)' });
  }

  res.json({
    posts: proxy.getPosts(),
    freeZones: proxy.getFreeZones(),
    summary: proxy.getSummary(),
    lastUpdate: proxy.getLastFetchTime()?.toISOString() || null,
  });
}));

// GET /api/monitoring/cameras — cameras with zone bindings and stream links
router.get('/cameras', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });
  const cameras = await proxy.fetchMonitoringCameras();
  res.json(cameras);
}));

// GET /api/monitoring/state/:zoneName — single zone/post state
router.get('/state/:zoneName', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy || !proxy.isRunning()) {
    return res.status(503).json({ error: 'Monitoring proxy not running' });
  }
  const raw = proxy.getRawState() || [];
  const zone = raw.find(z => z.zone === decodeURIComponent(req.params.zoneName));
  if (!zone) return res.status(404).json({ error: 'Zone not found' });
  res.json(zone);
}));

// GET /api/monitoring/raw — raw external API response
router.get('/raw', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });
  res.json(proxy.getRawState() || []);
}));

// GET /api/monitoring/history — proxy to external history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const { from, to, zone } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to parameters required' });
  }

  const history = await proxy.fetchMonitoringHistory(from, to);
  res.json(history);
}));

// GET /api/monitoring/zone-history/:zoneName — history for a specific zone
router.get('/zone-history/:zoneName', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const zoneName = decodeURIComponent(req.params.zoneName);
  const raw = proxy.getRawState() || [];
  const item = raw.find(z => z.zone === zoneName);

  // Also check full history
  if (!item) {
    const fullHistory = proxy.getFullHistory() || [];
    const histItem = fullHistory.find(z => z.zone === zoneName);
    if (histItem) return res.json(histItem);
    return res.status(404).json({ error: `Zone "${zoneName}" not found` });
  }

  res.json(item);
}));

// GET /api/monitoring/post-history/:postNumber — history for a specific post
router.get('/post-history/:postNumber', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const postNumber = parseInt(req.params.postNumber, 10);
  if (isNaN(postNumber) || postNumber < 1 || postNumber > 20) {
    return res.status(400).json({ error: 'Invalid post number' });
  }

  // Try cached full history first
  const postData = proxy.getPostHistory(postNumber);
  if (postData) {
    return res.json(postData);
  }

  // Fallback: search raw state
  const raw = proxy.getRawState() || [];
  const padded = String(postNumber).padStart(2, '0');
  const item = raw.find(z => {
    const m = z.zone?.match(/Пост\s+(\d{2})/);
    return m && m[1] === padded;
  });

  if (item) return res.json(item);
  res.status(404).json({ error: `Post ${postNumber} not found` });
}));

// GET /api/monitoring/full-history — full cached history (all zones with history arrays)
router.get('/full-history', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const fullHistory = proxy.getFullHistory();
  if (!fullHistory) {
    return res.json([]);
  }
  res.json(fullHistory);
}));

// GET /api/monitoring/health — external monitoring service health
router.get('/health', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const health = await proxy.fetchMonitoringHealth();
  res.json({
    proxy: { running: proxy.isRunning(), lastFetch: proxy.getLastFetchTime()?.toISOString() || null },
    external: health,
  });
}));

module.exports = router;
