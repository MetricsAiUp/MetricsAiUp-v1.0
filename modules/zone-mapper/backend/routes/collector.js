const { Router } = require('express');
const { enqueue } = require('../lib/monitoringDb');
const { nudge } = require('../lib/dbWorker');
const { mergeAnalyses } = require('../lib/zoneVerdict');

const router = Router();

/**
 * POST /api/collector/result
 * Receives analysis result for a zone, applies any-camera-occupied verdict,
 * enqueues for DB storage.
 *
 * Body: { zoneName, zoneType, analyses: [...], timestamp }
 */
router.post('/result', (req, res) => {
  const { zoneName, zoneType, analyses, timestamp } = req.body;

  if (!zoneName || !analyses || !Array.isArray(analyses)) {
    return res.status(400).json({ error: 'zoneName and analyses[] required' });
  }

  const m = mergeAnalyses(analyses);

  // If ALL analyses failed (API error, no money, etc.) — skip, don't update zone state
  if (!m) {
    console.log(`[Collector] ${zoneName}: ALL analyses failed, skipping (not updating state)`);
    return res.json({ ok: true, zoneName, status: 'skipped', reason: 'all_analyses_failed' });
  }

  enqueue({ zoneName, zoneType: zoneType || 'lift', mergedResult: m.merged, timestamp: timestamp || new Date().toISOString() });
  nudge();

  console.log(`[Collector] ${zoneName}: ${m.status} (${m.occupiedCount}/${m.validCount} occupied) → queued`);

  res.json({ ok: true, zoneName, status: m.status, queued: true });
});

/**
 * POST /api/collector/bulk
 * Receives analysis results for multiple zones at once.
 * Body: { results: [{ zoneName, zoneType, analyses, timestamp }, ...] }
 */
router.post('/bulk', (req, res) => {
  const { results } = req.body;
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'results[] required' });
  }

  let queued = 0;
  for (const r of results) {
    if (!r.zoneName || !r.analyses) continue;

    const m = mergeAnalyses(r.analyses);
    if (!m) continue; // skip if all failed

    enqueue({ zoneName: r.zoneName, zoneType: r.zoneType || 'lift', mergedResult: m.merged, timestamp: r.timestamp || new Date().toISOString() });
    queued++;
  }

  nudge();
  res.json({ ok: true, queued });
});

module.exports = router;
