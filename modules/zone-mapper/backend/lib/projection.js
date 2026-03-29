const { convexHull } = require('./convexHull');

const DEG2RAD = Math.PI / 180;
const NEAR_PLANE = 0.01;

/**
 * Build rotation matrix from Euler angles (YXZ order: yaw, pitch, roll in degrees).
 * Returns 3x3 matrix as flat array [row-major].
 */
function buildRotationMatrix(yaw, pitch, roll) {
  const cy = Math.cos(yaw * DEG2RAD), sy = Math.sin(yaw * DEG2RAD);
  const cp = Math.cos(pitch * DEG2RAD), sp = Math.sin(pitch * DEG2RAD);
  const cr = Math.cos(roll * DEG2RAD), sr = Math.sin(roll * DEG2RAD);

  // R = Ry * Rx * Rz
  return [
    cy * cr + sy * sp * sr,   -cy * sr + sy * sp * cr,  sy * cp,
    cp * sr,                    cp * cr,                 -sp,
    -sy * cr + cy * sp * sr,   sy * sr + cy * sp * cr,   cy * cp
  ];
}

/**
 * Transform world point to camera space.
 * camera: { position: {x,y,z}, rotation: {yaw,pitch,roll} }
 */
function worldToCamera(point, camera) {
  const R = buildRotationMatrix(
    camera.rotation.yaw,
    camera.rotation.pitch,
    camera.rotation.roll
  );

  // Translate: P - camPos
  const dx = point[0] - camera.position.x;
  const dy = point[1] - camera.position.y;
  const dz = point[2] - camera.position.z;

  // Apply R^T (transpose of rotation matrix) to get camera-space coords
  // R^T rows = R columns
  return [
    R[0] * dx + R[3] * dy + R[6] * dz,
    R[1] * dx + R[4] * dy + R[7] * dz,
    R[2] * dx + R[5] * dy + R[8] * dz
  ];
}

/**
 * Project camera-space point to pixel coordinates.
 * camera: { fov (degrees, horizontal), resolution: { width, height } }
 * Returns [px, py] or null if behind camera.
 */
function cameraToPixel(camPoint, camera) {
  const [x, y, z] = camPoint;
  if (z <= NEAR_PLANE) return null;

  const fovRad = camera.fov * DEG2RAD;
  const fx = 1.0 / Math.tan(fovRad / 2);
  const aspect = camera.resolution.width / camera.resolution.height;
  const fy = fx * aspect;

  const ndcX = (fx * x) / z;
  const ndcY = (fy * y) / z;

  const px = (ndcX + 1) * 0.5 * camera.resolution.width;
  const py = (1 - ndcY) * 0.5 * camera.resolution.height;

  return [Math.round(px * 100) / 100, Math.round(py * 100) / 100];
}

/**
 * Get 8 vertices of a zone box.
 * zone: { position: {x,y,z}, size: {width,height,depth} }
 */
function getZoneVertices(zone) {
  const { x, y, z } = zone.position;
  const { width: w, height: h, depth: d } = zone.size;
  return [
    [x, y, z],
    [x + w, y, z],
    [x, y + h, z],
    [x + w, y + h, z],
    [x, y, z + d],
    [x + w, y, z + d],
    [x, y + h, z + d],
    [x + w, y + h, z + d]
  ];
}

/**
 * Clip edge from A to B against near plane (z = NEAR_PLANE).
 * Both A and B are in camera space [x, y, z].
 * Returns array of visible points (0, 1, or 2).
 */
function clipEdge(A, B) {
  const aInside = A[2] > NEAR_PLANE;
  const bInside = B[2] > NEAR_PLANE;

  if (aInside && bInside) return [A, B];
  if (!aInside && !bInside) return [];

  // Interpolate at z = NEAR_PLANE
  const t = (NEAR_PLANE - A[2]) / (B[2] - A[2]);
  const clipped = [
    A[0] + t * (B[0] - A[0]),
    A[1] + t * (B[1] - A[1]),
    NEAR_PLANE
  ];

  return aInside ? [A, clipped] : [clipped, B];
}

/**
 * Project a zone onto a camera's image plane.
 * Returns { polygon: [[px,py], ...], visible: boolean }
 */
function projectZone(zone, camera) {
  const worldVerts = getZoneVertices(zone);

  // Transform all vertices to camera space
  const camVerts = worldVerts.map(v => worldToCamera(v, camera));

  // Clip edges of the bounding box and collect visible projected points
  // Edges of a box: 12 edges
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], // along X
    [0, 2], [1, 3], [4, 6], [5, 7], // along Y
    [0, 4], [1, 5], [2, 6], [3, 7]  // along Z
  ];

  const projectedPoints = [];

  for (const [i, j] of edges) {
    const clipped = clipEdge(camVerts[i], camVerts[j]);
    for (const pt of clipped) {
      const pixel = cameraToPixel(pt, camera);
      if (pixel) projectedPoints.push(pixel);
    }
  }

  if (projectedPoints.length < 3) {
    return { polygon: [], visible: false };
  }

  const hull = convexHull(projectedPoints);
  return {
    polygon: hull,
    visible: hull.length >= 3
  };
}

/**
 * Project all zones for a given camera.
 * zones: array of zone objects
 * camera: camera object
 * Returns array of { zoneId, zoneName, color, polygon, visible }
 */
function projectAllZones(zones, camera) {
  return zones.map(zone => {
    const { polygon, visible } = projectZone(zone, camera);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      color: zone.color,
      polygon,
      visible
    };
  });
}

module.exports = { projectZone, projectAllZones, worldToCamera, cameraToPixel, getZoneVertices };
