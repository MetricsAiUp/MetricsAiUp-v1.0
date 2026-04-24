const { Router } = require('express');
const { enqueue } = require('../lib/monitoringDb');
const { nudge } = require('../lib/dbWorker');

const router = Router();

/**
 * POST /api/collector/result
 * Receives analysis result for a zone, performs majority vote, enqueues for DB storage.
 *
 * Body: { zoneName, zoneType, analyses: [...], timestamp }
 */
router.post('/result', (req, res) => {
  const { zoneName, zoneType, analyses, timestamp } = req.body;

  if (!zoneName || !analyses || !Array.isArray(analyses)) {
    return res.status(400).json({ error: 'zoneName and analyses[] required' });
  }

  // Majority vote across camera analyses — only valid (non-error) results
  const valid = analyses.filter(a => !a.error);

  // If ALL analyses failed (API error, no money, etc.) — skip, don't update zone state
  if (valid.length === 0) {
    console.log(`[Collector] ${zoneName}: ALL analyses failed, skipping (not updating state)`);
    return res.json({ ok: true, zoneName, status: 'skipped', reason: 'all_analyses_failed' });
  }

  const occupiedCount = valid.filter(a => a.occupied).length;
  const freeCount = valid.filter(a => !a.occupied).length;
  const status = occupiedCount > freeCount ? 'occupied' : 'free';

  // Merge: take data from the highest-confidence occupied analysis, or first valid
  const best = valid.sort((a, b) => {
    const confOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0);
  })[0] || {};

  const mergedResult = {
    status,
    occupied: status === 'occupied',
    vehicle: best.vehicle || null,
    plate: best.plate || null,
    openParts: best.openParts || [],
    worksInProgress: !!best.worksInProgress,
    worksDescription: best.worksDescription || null,
    peopleCount: best.peopleCount || 0,
    confidence: best.confidence || 'LOW',
    description: best.description || '',
    camerasAnalyzed: analyses.length,
    camerasOccupied: occupiedCount,
    camerasFree: freeCount,
  };

  // Enqueue for DB worker
  enqueue({ zoneName, zoneType: zoneType || 'lift', mergedResult, timestamp: timestamp || new Date().toISOString() });

  // Nudge worker to process immediately
  nudge();

  console.log(`[Collector] ${zoneName}: ${status} (${occupiedCount}/${valid.length} occupied) → queued`);

  res.json({ ok: true, zoneName, status, queued: true });
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

    const valid = r.analyses.filter(a => !a.error);
    if (valid.length === 0) continue; // skip if all failed

    const occupiedCount = valid.filter(a => a.occupied).length;
    const freeCount = valid.filter(a => !a.occupied).length;
    const status = occupiedCount > freeCount ? 'occupied' : 'free';

    const best = valid.sort((a, b) => {
      const co = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (co[b.confidence] || 0) - (co[a.confidence] || 0);
    })[0] || {};

    const mergedResult = {
      status, occupied: status === 'occupied',
      vehicle: best.vehicle || null, plate: best.plate || null,
      openParts: best.openParts || [], worksInProgress: !!best.worksInProgress,
      worksDescription: best.worksDescription || null, peopleCount: best.peopleCount || 0,
      confidence: best.confidence || 'LOW', description: best.description || '',
      camerasAnalyzed: r.analyses.length, camerasOccupied: occupiedCount, camerasFree: freeCount,
    };

    enqueue({ zoneName: r.zoneName, zoneType: r.zoneType || 'lift', mergedResult, timestamp: r.timestamp || new Date().toISOString() });
    queued++;
  }

  nudge();
  res.json({ ok: true, queued });
});

module.exports = router;
