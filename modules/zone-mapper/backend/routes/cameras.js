const { Router } = require('express');
const { v4: uuid } = require('uuid');
const { read, update } = require('../lib/storage');
const { projectAllZones } = require('../lib/projection');

const router = Router({ mergeParams: true });

// List cameras in a room
router.get('/', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room.cameras || []);
});

// Create camera
router.post('/', (req, res) => {
  const { name, position, rotation, fov, resolution, rtspCameraId } = req.body;
  if (!name || !position || !rotation) {
    return res.status(400).json({ error: 'name, position {x,y,z}, rotation {yaw,pitch,roll} required' });
  }
  const camera = {
    id: uuid(),
    name,
    position: { x: Number(position.x), y: Number(position.y), z: Number(position.z) },
    rotation: {
      yaw: Number(rotation.yaw || 0),
      pitch: Number(rotation.pitch || 0),
      roll: Number(rotation.roll || 0)
    },
    fov: Number(fov || 90),
    resolution: {
      width: Number(resolution?.width || 1920),
      height: Number(resolution?.height || 1080)
    },
    rtspCameraId: rtspCameraId || null
  };
  let found = false;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    room.cameras = room.cameras || [];
    room.cameras.push(camera);
    found = true;
  });
  if (!found) return res.status(404).json({ error: 'Room not found' });
  res.status(201).json(camera);
});

// Update camera
router.put('/:cameraId', (req, res) => {
  let found = null;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    const cam = (room.cameras || []).find(c => c.id === req.params.cameraId);
    if (!cam) return;
    const { name, position, rotation, fov, resolution, rtspCameraId } = req.body;
    if (name !== undefined) cam.name = name;
    if (position) {
      cam.position = {
        x: Number(position.x ?? cam.position.x),
        y: Number(position.y ?? cam.position.y),
        z: Number(position.z ?? cam.position.z)
      };
    }
    if (rotation) {
      cam.rotation = {
        yaw: Number(rotation.yaw ?? cam.rotation.yaw),
        pitch: Number(rotation.pitch ?? cam.rotation.pitch),
        roll: Number(rotation.roll ?? cam.rotation.roll)
      };
    }
    if (fov !== undefined) cam.fov = Number(fov);
    if (resolution) {
      cam.resolution = {
        width: Number(resolution.width ?? cam.resolution.width),
        height: Number(resolution.height ?? cam.resolution.height)
      };
    }
    if (rtspCameraId !== undefined) cam.rtspCameraId = rtspCameraId || null;
    found = cam;
  });
  if (!found) return res.status(404).json({ error: 'Camera not found' });
  res.json(found);
});

// Delete camera
router.delete('/:cameraId', (req, res) => {
  let deleted = false;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    const idx = (room.cameras || []).findIndex(c => c.id === req.params.cameraId);
    if (idx !== -1) { room.cameras.splice(idx, 1); deleted = true; }
  });
  if (!deleted) return res.status(404).json({ error: 'Camera not found' });
  res.json({ ok: true });
});

// Get 2D projections of all zones for this camera
router.get('/:cameraId/projection', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const camera = (room.cameras || []).find(c => c.id === req.params.cameraId);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });

  const projections = projectAllZones(room.zones || [], camera);
  res.json({
    camera: { id: camera.id, name: camera.name, resolution: camera.resolution },
    projections
  });
});

// Get custom 2D zone overrides for this camera
router.get('/:cameraId/zones2d', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const camera = (room.cameras || []).find(c => c.id === req.params.cameraId);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });
  res.json(camera.zones2d || null);
});

// Save custom 2D zone overrides for this camera
router.put('/:cameraId/zones2d', (req, res) => {
  let found = null;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    const cam = (room.cameras || []).find(c => c.id === req.params.cameraId);
    if (!cam) return;
    cam.zones2d = req.body.zones2d;
    found = cam.zones2d;
  });
  if (found === null && !req.body.zones2d) return res.json(null);
  if (found === undefined) return res.status(404).json({ error: 'Camera not found' });
  res.json(found);
});

// Export motion detection config for this camera
router.get('/:cameraId/export', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const camera = (room.cameras || []).find(c => c.id === req.params.cameraId);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });

  const projections = projectAllZones(room.zones || [], camera);
  const config = {
    cameraName: camera.name,
    cameraId: camera.id,
    resolution: camera.resolution,
    motionZones: projections
      .filter(p => p.visible)
      .map(p => ({
        name: p.zoneName,
        id: p.zoneId,
        color: p.color,
        polygon: p.polygon
      }))
  };

  res.json(config);
});

module.exports = router;
