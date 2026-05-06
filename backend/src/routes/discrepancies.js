// REST API для нестыковок между 1С и CV.
// Permissions:
//   view_1c              — читать список/детали/статистику
//   manage_discrepancies — менять статус, форс-пересчёт

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const detector = require('../services/discrepancyDetector');
const { updateStatusSchema } = require('../schemas/discrepancies');

function parseInteger(v, def, max = 1000) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return def;
  return Math.min(n, max);
}

function buildWhere(query) {
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.severity) where.severity = String(query.severity);
  if (query.type) where.type = String(query.type);
  if (query.postId) where.postId = String(query.postId);
  if (query.orderNumber) where.orderNumber = String(query.orderNumber);
  if (query.from || query.to) {
    where.detectedAt = {};
    if (query.from) where.detectedAt.gte = new Date(String(query.from));
    if (query.to) where.detectedAt.lte = new Date(String(query.to));
  }
  return where;
}

// GET /api/discrepancies — list with filters & pagination
router.get('/', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const [rows, total] = await Promise.all([
      prisma.discrepancy.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        take,
        skip,
      }),
      prisma.discrepancy.count({ where }),
    ]);

    // Подмешиваем связанные post и vehicleSession (нет FK в schema)
    const postIds = [...new Set(rows.map((r) => r.postId).filter(Boolean))];
    const sessionIds = [...new Set(rows.map((r) => r.vehicleSessionId).filter(Boolean))];
    const [posts, sessions] = await Promise.all([
      postIds.length
        ? prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, name: true, number: true } })
        : [],
      sessionIds.length
        ? prisma.vehicleSession.findMany({
            where: { id: { in: sessionIds } },
            select: { id: true, plateNumber: true, entryTime: true, exitTime: true },
          })
        : [],
    ]);
    const postsById = new Map(posts.map((p) => [p.id, p]));
    const sessionsById = new Map(sessions.map((s) => [s.id, s]));
    const items = rows.map((r) => ({
      ...r,
      post: r.postId ? postsById.get(r.postId) || null : null,
      vehicleSession: r.vehicleSessionId ? sessionsById.get(r.vehicleSessionId) || null : null,
    }));
    res.json({ items, total, take, skip });
  } catch (err) {
    logger.error('GET /discrepancies failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discrepancies/stats — KPI
router.get('/stats', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, open, last24, byType, bySeverity] = await Promise.all([
      prisma.discrepancy.count(),
      prisma.discrepancy.count({ where: { status: 'open' } }),
      prisma.discrepancy.count({ where: { detectedAt: { gte: since24 } } }),
      prisma.discrepancy.groupBy({ by: ['type'], _count: { _all: true } }),
      prisma.discrepancy.groupBy({ by: ['severity'], _count: { _all: true } }),
    ]);

    res.json({
      total,
      open,
      newLast24h: last24,
      byType: byType.map((g) => ({ type: g.type, count: g._count._all })),
      bySeverity: bySeverity.map((g) => ({ severity: g.severity, count: g._count._all })),
    });
  } catch (err) {
    logger.error('GET /discrepancies/stats failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discrepancies/:id — detail (1С + CV side-by-side)
router.get('/:id', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const item = await prisma.discrepancy.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Discrepancy not found' });
    const post = item.postId
      ? await prisma.post.findUnique({ where: { id: item.postId }, select: { id: true, name: true, number: true } })
      : null;
    const session = item.vehicleSessionId
      ? await prisma.vehicleSession.findUnique({ where: { id: item.vehicleSessionId } })
      : null;
    item.post = post;
    item.vehicleSession = session;

    // Сторонние данные: связанный заказ-наряд (если есть)
    let order = null;
    if (item.orderNumber) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY received_at DESC) AS rn
           FROM one_c_work_order_merged
           WHERE order_number = ?
         ) WHERE rn = 1 LIMIT 1`,
        item.orderNumber
      );
      order = rows[0] || null;
    }

    res.json({ ...item, oneCOrder: order });
  } catch (err) {
    logger.error('GET /discrepancies/:id failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/discrepancies/:id/status
router.patch(
  '/:id/status',
  authenticate,
  requirePermission('manage_discrepancies'),
  validate(updateStatusSchema),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!id) return res.status(400).json({ error: 'id required' });
      const { status, closeReason, closeComment } = req.body;
      const actor = req.user?.email || req.user?.id || null;
      const now = new Date();
      const data = { status };
      // По схеме: разные пары полей под acknowledged / resolved
      if (status === 'acknowledged') {
        data.acknowledgedAt = now;
        data.acknowledgedBy = actor;
      } else if (status === 'resolved' || status === 'dismissed') {
        data.resolvedAt = now;
        data.resolvedBy = actor;
        data.closeReason = closeReason ?? null;
        data.closeComment = closeComment ?? null;
      } else {
        // open
        data.acknowledgedAt = null;
        data.acknowledgedBy = null;
        data.resolvedAt = null;
        data.resolvedBy = null;
        data.closeReason = null;
        data.closeComment = null;
      }
      const updated = await prisma.discrepancy.update({ where: { id }, data });
      res.json(updated);
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Discrepancy not found' });
      logger.error('PATCH /discrepancies/:id/status failed', { err: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/discrepancies/run — форс-пересчёт всей детекции
router.post('/run', authenticate, requirePermission('manage_discrepancies'), async (req, res) => {
  try {
    const since = req.body?.since || '7d';
    const result = await detector.detectAll({ since });
    res.json(result);
  } catch (err) {
    logger.error('POST /discrepancies/run failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
