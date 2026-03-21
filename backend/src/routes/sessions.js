const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/sessions — активные сессии авто
router.get('/', authenticate, async (req, res) => {
  try {
    const { status = 'active', limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      prisma.vehicleSession.findMany({
        where,
        include: {
          zoneStays: {
            where: { exitTime: null },
            include: { zone: true },
          },
          postStays: {
            where: { endTime: null },
            include: { post: true },
          },
        },
        orderBy: { entryTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.vehicleSession.count({ where }),
    ]);

    res.json({ sessions, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await prisma.vehicleSession.findUnique({
      where: { id: req.params.id },
      include: {
        zoneStays: { include: { zone: true }, orderBy: { entryTime: 'asc' } },
        postStays: { include: { post: true }, orderBy: { startTime: 'asc' } },
        workOrderLinks: { include: { workOrder: true } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
