const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createEventSchema } = require('../schemas/events');
const { processEvent } = require('../services/eventProcessor');

// POST /api/events — приём событий от CV-системы
router.post('/', validate(createEventSchema), async (req, res) => {
  try {
    const result = await processEvent(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events — журнал событий
router.get('/', authenticate, async (req, res) => {
  try {
    const { zoneId, postId, postNumber, type, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (zoneId) where.zoneId = zoneId;
    if (postId) where.postId = postId;
    if (postNumber && !postId) {
      const padded = String(postNumber).padStart(2, '0');
      const post = await prisma.post.findFirst({ where: { name: `Пост ${padded}`, isActive: true } });
      if (post) where.postId = post.id;
    }
    if (type) where.type = type;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          zone: true,
          post: true,
          vehicleSession: true,
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ events, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
