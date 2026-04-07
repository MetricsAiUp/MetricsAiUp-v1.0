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
