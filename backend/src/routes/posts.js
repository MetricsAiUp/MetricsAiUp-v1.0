const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createPostSchema, updatePostSchema } = require('../schemas/posts');

// GET /api/posts
router.get('/', authenticate, async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.zoneId) where.zoneId = req.query.zoneId;

    const posts = await prisma.post.findMany({
      where,
      include: {
        zone: true,
        stays: {
          where: { endTime: null },
          include: { vehicleSession: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:id
// GET /api/posts/by-number/:number/history — full history for a post by number
router.get('/by-number/:number/history', authenticate, async (req, res) => {
  try {
    const padded = String(req.params.number).padStart(2, '0');
    const post = await prisma.post.findFirst({
      where: { name: `Пост ${padded}`, isActive: true },
      include: { zone: true },
    });
    if (!post) return res.status(404).json({ error: `Post ${req.params.number} not found` });

    const { from, to, limit = 200 } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const [events, stays, workOrders] = await Promise.all([
      prisma.event.findMany({
        where: {
          postId: post.id,
          ...(from || to ? { createdAt: dateFilter } : {}),
        },
        include: { vehicleSession: true, camera: true },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      }),
      prisma.postStay.findMany({
        where: {
          postId: post.id,
          ...(from || to ? { startTime: dateFilter } : {}),
        },
        include: { vehicleSession: true },
        orderBy: { startTime: 'desc' },
        take: parseInt(limit),
      }),
      prisma.workOrder.findMany({
        where: {
          postNumber: parseInt(req.params.number),
          ...(from || to ? { scheduledTime: dateFilter } : {}),
        },
        orderBy: { scheduledTime: 'desc' },
        take: parseInt(limit),
      }),
    ]);

    res.json({
      post: { id: post.id, name: post.name, type: post.type, status: post.status, zone: post.zone },
      events,
      stays,
      workOrders,
      summary: {
        totalEvents: events.length,
        totalStays: stays.length,
        totalWorkOrders: workOrders.length,
        uniquePlates: [...new Set([
          ...events.filter(e => e.vehicleSession?.plateNumber).map(e => e.vehicleSession.plateNumber),
          ...stays.filter(s => s.vehicleSession?.plateNumber).map(s => s.vehicleSession.plateNumber),
        ])].length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        zone: true,
        stays: {
          orderBy: { startTime: 'desc' },
          take: 10,
          include: { vehicleSession: true },
        },
      },
    });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts
router.post('/', authenticate, requirePermission('manage_zones'), validate(createPostSchema), async (req, res) => {
  try {
    const post = await prisma.post.create({ data: req.body });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/posts/:id
router.put('/:id', authenticate, requirePermission('manage_zones'), validate(updatePostSchema), async (req, res) => {
  try {
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/posts/:id (soft delete)
router.delete('/:id', authenticate, requirePermission('manage_zones'), async (req, res) => {
  try {
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Post deactivated', id: post.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Post not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
