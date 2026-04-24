const { Router } = require('express');
const { getFullState, getZoneState, getFullStateForPeriod, getHistoryForPeriod } = require('../lib/monitoringDb');
const { read } = require('../lib/storage');

const router = Router();

/**
 * GET /api/monitoring/state — all zones current state + 24h history
 * Query params: ?from=ISO&to=ISO — filter history by period
 */
router.get('/state', (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) {
      const state = getFullStateForPeriod(from, to);
      return res.json(state);
    }
    const state = getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monitoring/state/:zoneName — single zone state + 24h history
 * Query params: ?from=ISO&to=ISO — filter history by period
 */
router.get('/state/:zoneName', (req, res) => {
  try {
    const zoneName = decodeURIComponent(req.params.zoneName);
    const { from, to } = req.query;

    if (from && to) {
      const allForPeriod = getFullStateForPeriod(from, to);
      const zone = allForPeriod.find(z => z.zone === zoneName);
      if (!zone) return res.status(404).json({ error: 'Zone not found' });
      return res.json(zone);
    }

    const zone = getZoneState(zoneName);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monitoring/history — raw history records for a period
 * Query params: from=ISO (required), to=ISO (required), zone=name (optional)
 */
router.get('/history', (req, res) => {
  try {
    const { from, to, zone } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required (ISO datetime)' });
    }
    const history = getHistoryForPeriod(from, to, zone ? decodeURIComponent(zone) : null);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monitoring/cameras — all cameras with their zones and stream URLs
 */
router.get('/cameras', (req, res) => {
  try {
    const store = read();
    const streamBase = 'https://dev.metricsavto.com/p/test1/8181';
    const cameras = [];

    // Only use "Настоящая ремзона" room
    const room = (store.rooms || []).find(r => r.name && r.name.includes('Настоящая'));
    if (!room) return res.json([]);

    const zones3d = room.zones || [];

    for (const cam of room.cameras || []) {
      if (!cam.rtspCameraId) continue;

      // Collect zones this camera sees (from zones2d)
      const zones = (cam.zones2d || []).map(z2d => {
        const z3d = zones3d.find(z => z.id === z2d.zoneId);
        return {
          zone: z3d?.name || z2d.zoneName,
          type: z3d?.type || 'lift',
        };
      });

      cameras.push({
        id: cam.rtspCameraId,
        name: cam.name,
        zones: zones,
        stream: {
          status: `${streamBase}/api/stream/status`,
          start: `POST ${streamBase}/api/stream/start/${cam.rtspCameraId}`,
          stop: `POST ${streamBase}/api/stream/stop/${cam.rtspCameraId}`,
          hls: `${streamBase}/hls/${cam.rtspCameraId}/stream.m3u8`,
          snapshot: `${streamBase}/api/stream/snapshot/${cam.rtspCameraId}`,
          snapshot_nocache: `${streamBase}/api/stream/snapshot/${cam.rtspCameraId}?t=${Date.now()}`,
        },
      });
    }

    res.json(cameras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monitoring/health — service health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'monitoring',
  });
});

module.exports = router;
