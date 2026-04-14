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
