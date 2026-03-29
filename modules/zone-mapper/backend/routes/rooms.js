const { Router } = require('express');
const { v4: uuid } = require('uuid');
const { read, update } = require('../lib/storage');

const router = Router();

// List all rooms (without nested data for listing)
router.get('/', (req, res) => {
  const { rooms } = read();
  res.json(rooms.map(r => ({
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    depth: r.depth,
    camerasCount: (r.cameras || []).length,
    zonesCount: (r.zones || []).length
  })));
});

// Get single room with all data
router.get('/:id', (req, res) => {
  const { rooms } = read();
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// Create room
router.post('/', (req, res) => {
  const { name, width, height, depth } = req.body;
  if (!name || !width || !height || !depth) {
    return res.status(400).json({ error: 'name, width, height, depth required' });
  }
  const room = {
    id: uuid(),
    name,
    width: Number(width),
    height: Number(height),
    depth: Number(depth),
    cameras: [],
    zones: []
  };
  update(data => { data.rooms.push(room); });
  res.status(201).json(room);
});

// Update room
router.put('/:id', (req, res) => {
  let found = null;
  update(data => {
    const room = data.rooms.find(r => r.id === req.params.id);
    if (!room) return;
    const { name, width, height, depth } = req.body;
    if (name !== undefined) room.name = name;
    if (width !== undefined) room.width = Number(width);
    if (height !== undefined) room.height = Number(height);
    if (depth !== undefined) room.depth = Number(depth);
    found = room;
  });
  if (!found) return res.status(404).json({ error: 'Room not found' });
  res.json(found);
});

// Delete room
router.delete('/:id', (req, res) => {
  let deleted = false;
  update(data => {
    const idx = data.rooms.findIndex(r => r.id === req.params.id);
    if (idx !== -1) { data.rooms.splice(idx, 1); deleted = true; }
  });
  if (!deleted) return res.status(404).json({ error: 'Room not found' });
  res.json({ ok: true });
});

module.exports = router;
