const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/monitoring/state — full monitoring state (posts + zones)
// History-массивы намеренно не отдаём — клиенты (dashboard, фронт)
// используют только current-поля + summary. Полную историю можно
// получить через /api/monitoring/full-history. Без strip ответ может
// весить 19+ МБ и сильно тормозить фронт при auto-refresh каждые 10с.
router.get('/state', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy || !proxy.isRunning()) {
    return res.status(503).json({ error: 'Monitoring proxy not running (switch to live mode)' });
  }
  const stripHistory = (arr) => (arr || []).map(({ history: _h, ...rest }) => rest);
  res.json({
    posts: stripHistory(proxy.getPosts()),
    freeZones: stripHistory(proxy.getFreeZones()),
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

// Merge API history with DB history (deduplicate by timestamp)
function mergeHistories(apiHistory, dbHistory) {
  const seen = new Set();
  const merged = [];
  for (const h of (apiHistory || [])) {
    const key = h.timestamp;
    if (!seen.has(key)) { seen.add(key); merged.push(h); }
  }
  for (const h of (dbHistory || [])) {
    const key = h.timestamp;
    if (!seen.has(key)) { seen.add(key); merged.push(h); }
  }
  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return merged;
}

// GET /api/monitoring/zone-history/:zoneName — history for a specific zone
router.get('/zone-history/:zoneName', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const zoneName = decodeURIComponent(req.params.zoneName);

  // Get current state from API cache
  const raw = proxy.getRawState() || [];
  let item = raw.find(z => z.zone === zoneName);
  if (!item) {
    const fullHistory = proxy.getFullHistory() || [];
    item = fullHistory.find(z => z.zone === zoneName);
  }

  // Get DB history
  const dbHistory = await proxy.getZoneHistoryFromDB(zoneName);

  if (!item && dbHistory.length === 0) {
    return res.status(404).json({ error: `Zone "${zoneName}" not found` });
  }

  const result = item ? { ...item } : { zone: zoneName, status: 'free', history: [] };
  result.history = mergeHistories(item?.history, dbHistory);
  res.json(result);
}));

// GET /api/monitoring/post-history/:postNumber — history for a specific post
router.get('/post-history/:postNumber', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });

  const postNumber = parseInt(req.params.postNumber, 10);
  if (isNaN(postNumber) || postNumber < 1 || postNumber > 20) {
    return res.status(400).json({ error: 'Invalid post number' });
  }

  // Try cached history
  let item = proxy.getPostHistory(postNumber);
  if (!item) {
    const raw = proxy.getRawState() || [];
    const padded = String(postNumber).padStart(2, '0');
    item = raw.find(z => {
      const m = z.zone?.match(/Пост\s+(\d{2})/);
      return m && m[1] === padded;
    });
  }

  // Get DB history for this post zone name
  const padded = String(postNumber).padStart(2, '0');
  const zoneNames = await proxy.getZoneNamesFromDB();
  const postZoneName = zoneNames.find(n => {
    const m = n.match(/Пост\s+(\d{2})/);
    return m && m[1] === padded;
  });

  const dbHistory = postZoneName ? await proxy.getZoneHistoryFromDB(postZoneName) : [];

  if (!item && dbHistory.length === 0) {
    return res.status(404).json({ error: `Post ${postNumber} not found` });
  }

  const result = item ? { ...item } : { zone: postZoneName || `Пост ${padded}`, status: 'free', history: [] };
  result.history = mergeHistories(item?.history, dbHistory);
  res.json(result);
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

// GET /api/monitoring/db-stats — статистика по сохранённым данным мониторинга в нашей БД
router.get('/db-stats', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });
  const stats = await proxy.getDbStats();
  res.json(stats);
}));

// GET /api/monitoring/db-current — актуальное состояние всех зон/постов из нашей БД
router.get('/db-current', authenticate, asyncHandler(async (req, res) => {
  const proxy = req.app.get('monitoringProxy');
  if (!proxy) return res.status(503).json({ error: 'Monitoring proxy not available' });
  const rows = await proxy.getCurrentFromDB();
  res.json(rows);
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
