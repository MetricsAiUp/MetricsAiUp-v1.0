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
const scheduler = require('../services/discrepancyDetectorScheduler');
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
  if (query.orderNumber) where.orderNumber = { contains: String(query.orderNumber) };

  // Фильтр периода: применяется к occurred_at (дата реального события).
  // Если occurred_at NULL — откатываемся на detected_at, чтобы старые записи без бэкфилла
  // тоже были найдены по периоду их регистрации детектором.
  if (query.from || query.to) {
    const from = query.from ? new Date(String(query.from)) : null;
    const to = query.to ? new Date(String(query.to)) : null;
    const range = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    where.OR = [
      { occurredAt: range },
      { AND: [{ occurredAt: null }, { detectedAt: range }] },
    ];
  }

  // Полнотекстовый поиск (description / orderNumber / plateNumber / vin)
  if (query.q) {
    const q = String(query.q).trim();
    if (q) {
      const term = { contains: q };
      const orSearch = [
        { description: term },
        { orderNumber: term },
        { plateNumber: term },
        { vin: term },
      ];
      // Если уже есть OR от периода — комбинируем через AND-обёртку
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: orSearch }];
        delete where.OR;
      } else {
        where.OR = orSearch;
      }
    }
  }

  return where;
}

// GET /api/discrepancies — list with filters, sorting & pagination
const SORT_FIELDS = {
  occurredAt: 'occurredAt',
  detectedAt: 'detectedAt',
  type: 'type',
  severity: 'severity',
  status: 'status',
  orderNumber: 'orderNumber',
};

function buildOrderBy(query) {
  const dir = String(query.sortDir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const field = SORT_FIELDS[String(query.sortBy || '')] || 'occurredAt';

  // Дефолт — занять детектируемые свежие события сверху, NULL вниз, фоллбек на detectedAt.
  if (field === 'occurredAt') {
    return [
      { occurredAt: { sort: dir, nulls: 'last' } },
      { detectedAt: dir },
    ];
  }
  // Для прочих полей — основной + tie-break по occurredAt
  return [
    { [field]: dir },
    { occurredAt: { sort: 'desc', nulls: 'last' } },
    { detectedAt: 'desc' },
  ];
}

router.get('/', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const orderBy = buildOrderBy(req.query);
    const [rows, total] = await Promise.all([
      prisma.discrepancy.findMany({ where, orderBy, take, skip }),
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

// POST /api/discrepancies/run — асинхронный форс-пересчёт.
// Возвращает 202 сразу. Прогресс смотреть через GET /schedule (поле isRunning + lastRun*).
router.post('/run', authenticate, requirePermission('manage_discrepancies'), async (req, res) => {
  try {
    const state = scheduler.getState();
    if (state.isRunning) {
      return res.status(202).json({ ok: true, alreadyRunning: true, state });
    }
    const since = req.body?.since;
    // fire-and-forget; ошибки уже записываются в lastError внутри scheduler
    scheduler.runOnce({ trigger: 'manual', since }).catch((err) => {
      logger.error('runOnce background failure', { err: err.message });
    });
    res.status(202).json({ ok: true, started: true, state: scheduler.getState() });
  } catch (err) {
    logger.error('POST /discrepancies/run failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discrepancies/schedule — конфиг + last-run state
router.get('/schedule', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    res.json(scheduler.getState());
  } catch (err) {
    logger.error('GET /discrepancies/schedule failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/discrepancies/schedule — обновить конфиг (enabled/time/timezone/sinceWindow)
router.put('/schedule', authenticate, requirePermission('manage_discrepancies'), async (req, res) => {
  try {
    const { enabled, time, timezone, sinceWindow } = req.body || {};
    const next = scheduler.setConfig({ enabled, time, timezone, sinceWindow });
    res.json(next);
  } catch (err) {
    logger.warn('PUT /discrepancies/schedule failed', { err: err.message });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
