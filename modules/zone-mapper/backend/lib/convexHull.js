/**
 * Graham scan convex hull for 2D points.
 * Input: array of [x, y] pairs.
 * Output: array of [x, y] pairs forming the convex hull (CCW order).
 */
function cross(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

function convexHull(points) {
  if (points.length <= 1) return points.slice();

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  for (const p of points) {
    const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  if (unique.length <= 2) return unique;

  unique.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const lower = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

module.exports = { convexHull };
