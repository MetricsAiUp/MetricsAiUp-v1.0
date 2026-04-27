/**
 * Merge per-camera analyses into a single zone verdict.
 *
 * Rule: a zone is OCCUPIED if ANY camera sees it occupied (no majority vote).
 * Rationale: in 2-camera setups one angle frequently misses the car
 * (perspective, glare, partial frame), so a 1:1 split must resolve to
 * "occupied" — missing a car is worse than a false positive that the next
 * cycle clears on its own.
 *
 * For the merged "best" record we prefer, in order:
 *   1. an occupied camera that read a plate (most authoritative);
 *   2. the highest-confidence occupied camera;
 *   3. the highest-confidence camera overall (used only when status=free).
 *
 * Returns null when every analysis errored (caller should skip the update
 * and not overwrite the previous good state).
 */
const CONF_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function mergeAnalyses(analyses) {
  const valid = (analyses || []).filter(a => !a.error);
  if (valid.length === 0) return null;

  const occupiedList = valid.filter(a => a.occupied);
  const occupiedCount = occupiedList.length;
  const freeCount = valid.length - occupiedCount;
  const status = occupiedCount > 0 ? 'occupied' : 'free';

  const byConf = (a, b) => (CONF_ORDER[b.confidence] || 0) - (CONF_ORDER[a.confidence] || 0);
  const best =
    occupiedList.find(a => a.plate) ||
    occupiedList.sort(byConf)[0] ||
    valid.sort(byConf)[0] ||
    {};

  return {
    status,
    merged: {
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
    },
    occupiedCount,
    freeCount,
    validCount: valid.length,
  };
}

module.exports = { mergeAnalyses };
