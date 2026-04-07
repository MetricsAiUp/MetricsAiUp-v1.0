const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/audit-log — list audit logs with filters
router.get('/', authenticate, async (req, res) => {
  try {
    // Only admin can view audit logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userId, action, entity, from, to, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
