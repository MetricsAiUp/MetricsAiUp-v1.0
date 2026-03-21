const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/recommendations
router.get('/', authenticate, async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const recommendations = await prisma.recommendation.findMany({
      where: { status },
      include: { zone: true, post: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recommendations/:id/acknowledge
router.put('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const rec = await prisma.recommendation.update({
      where: { id: req.params.id },
      data: { status: 'acknowledged' },
    });
    res.json(rec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
