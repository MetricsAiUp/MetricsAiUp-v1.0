const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCameraSchema, updateCameraSchema, setCameraZonesSchema } = require('../schemas/cameras');

// GET /api/cameras — list all active cameras with zone mappings
router.get('/', authenticate, async (req, res) => {
  try {
    const cameras = await prisma.camera.findMany({
      where: { isActive: true },
      include: {
        zones: { include: { zone: true }, orderBy: { priority: 'asc' } },
        _count: { select: { events: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(cameras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cameras/:id — single camera with zones
router.get('/:id', authenticate, async (req, res) => {
  try {
    const camera = await prisma.camera.findUnique({
      where: { id: req.params.id },
      include: {
        zones: { include: { zone: true }, orderBy: { priority: 'asc' } },
        events: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!camera) return res.status(404).json({ error: 'Камера не найдена' });
    res.json(camera);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cameras — create camera
router.post('/', authenticate, requirePermission('manage_cameras'), validate(createCameraSchema), async (req, res) => {
  try {
    const { name, rtspUrl } = req.body;
    if (!name || !rtspUrl) {
      return res.status(400).json({ error: 'name and rtspUrl are required' });
    }
    const camera = await prisma.camera.create({
      data: { name, rtspUrl },
    });
    res.status(201).json(camera);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/cameras/:id — update camera
router.put('/:id', authenticate, requirePermission('manage_cameras'), validate(updateCameraSchema), async (req, res) => {
  try {
    const { name, rtspUrl, isActive } = req.body;
    const camera = await prisma.camera.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(rtspUrl !== undefined && { rtspUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        zones: { include: { zone: true }, orderBy: { priority: 'asc' } },
      },
    });
    res.json(camera);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Камера не найдена' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cameras/:id — soft delete (isActive = false)
router.delete('/:id', authenticate, requirePermission('manage_cameras'), async (req, res) => {
  try {
    const camera = await prisma.camera.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Камера деактивирована', id: camera.id });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Камера не найдена' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cameras/:id/zones — set zone mappings (replaces all existing)
// Body: { zones: [{ zoneId: number, priority: number }] }
router.post('/:id/zones', authenticate, requirePermission('manage_cameras'), validate(setCameraZonesSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { zones: mappings } = req.body;

    // Verify camera exists
    const camera = await prisma.camera.findUnique({ where: { id } });
    if (!camera) return res.status(404).json({ error: 'Камера не найдена' });

    // Replace all zone mappings in a transaction
    await prisma.$transaction([
      prisma.cameraZone.deleteMany({ where: { cameraId: id } }),
      ...mappings.map((m) =>
        prisma.cameraZone.create({
          data: {
            cameraId: id,
            zoneId: m.zoneId,
            priority: m.priority ?? 0,
          },
        })
      ),
    ]);

    // Return updated camera with zones
    const updated = await prisma.camera.findUnique({
      where: { id },
      include: {
        zones: { include: { zone: true }, orderBy: { priority: 'asc' } },
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
