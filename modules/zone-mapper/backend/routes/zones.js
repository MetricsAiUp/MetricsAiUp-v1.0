const { Router } = require('express');
const { v4: uuid } = require('uuid');
const { read, update } = require('../lib/storage');

const router = Router({ mergeParams: true });

// List zones in a room
router.get('/', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room.zones || []);
});

// Create zone
router.post('/', (req, res) => {
  const { name, position, size, color } = req.body;
  if (!name || !position || !size) {
    return res.status(400).json({ error: 'name, position {x,y,z}, size {width,height,depth} required' });
  }
  const zone = {
    id: uuid(),
    name,
    position: { x: Number(position.x), y: Number(position.y), z: Number(position.z) },
    size: { width: Number(size.width), height: Number(size.height), depth: Number(size.depth) },
    color: color || '#00ff00'
  };
  let found = false;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    room.zones = room.zones || [];
    room.zones.push(zone);
    found = true;
  });
  if (!found) return res.status(404).json({ error: 'Room not found' });
  res.status(201).json(zone);
});

// Update zone
router.put('/:zoneId', (req, res) => {
  let found = null;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    const zone = (room.zones || []).find(z => z.id === req.params.zoneId);
    if (!zone) return;
    const { name, position, size, color } = req.body;
    if (name !== undefined) zone.name = name;
    if (position) {
      zone.position = {
        x: Number(position.x ?? zone.position.x),
        y: Number(position.y ?? zone.position.y),
        z: Number(position.z ?? zone.position.z)
      };
    }
    if (size) {
      zone.size = {
        width: Number(size.width ?? zone.size.width),
        height: Number(size.height ?? zone.size.height),
        depth: Number(size.depth ?? zone.size.depth)
      };
    }
    if (color !== undefined) zone.color = color;
    found = zone;
  });
  if (!found) return res.status(404).json({ error: 'Zone not found' });
  res.json(found);
});

// Delete zone
router.delete('/:zoneId', (req, res) => {
  let deleted = false;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.roomId);
    if (!room) return;
    const idx = (room.zones || []).findIndex(z => z.id === req.params.zoneId);
    if (idx !== -1) { room.zones.splice(idx, 1); deleted = true; }
  });
  if (!deleted) return res.status(404).json({ error: 'Zone not found' });
  res.json({ ok: true });
});

module.exports = router;
