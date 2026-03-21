const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

// GET /api/zones
router.get('/', authenticate, async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      include: {
        posts: true,
        cameras: { include: { camera: true } },
        _count: { select: { stays: { where: { exitTime: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id },
      include: {
        posts: true,
        stays: {
          where: { exitTime: null },
          include: { vehicleSession: true },
        },
        cameras: { include: { camera: true } },
      },
    });
    if (!zone) return res.status(404).json({ error: 'Зона не найдена' });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones
router.post('/', authenticate, requirePermission('manage_zones'), async (req, res) => {
  try {
    const zone = await prisma.zone.create({ data: req.body });
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/zones/:id
router.put('/:id', authenticate, requirePermission('manage_zones'), async (req, res) => {
  try {
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
