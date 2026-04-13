const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { importCsvSchema, assignSchema, scheduleSchema } = require('../schemas/workOrders');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

/**
 * @openapi
 * /api/work-orders:
 *   get:
 *     summary: List work orders with optional filters
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by work order status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Max number of orders to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by scheduled date (from)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by scheduled date (to)
 *     responses:
 *       200:
 *         description: Paginated list of work orders with total count
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0, dateFrom, dateTo } = req.query;
    const where = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.scheduledTime = {};
      if (dateFrom) where.scheduledTime.gte = new Date(dateFrom);
      if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); where.scheduledTime.lte = end; }
    }

    const [orders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          links: {
            include: { vehicleSession: true, postStay: true },
          },
        },
        orderBy: { scheduledTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.workOrder.count({ where }),
    ]);

    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/work-orders/import-csv:
 *   post:
 *     summary: Import work orders from CSV data
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csvData]
 *             properties:
 *               csvData:
 *                 type: string
 *                 description: Raw CSV content with headers
 *     responses:
 *       201:
 *         description: Import successful with count and created orders
 *       400:
 *         description: Missing csvData
 *       403:
 *         description: Insufficient permissions
 */
router.post('/import-csv', authenticate, requirePermission('manage_work_orders'), validate(importCsvSchema), async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ error: 'csvData обязателен' });

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const created = [];
    for (const row of records) {
      const order = await prisma.workOrder.create({
        data: {
          externalId: row.id || row.external_id || null,
          orderNumber: row.order_number || row.number || `WO-${Date.now()}`,
          scheduledTime: new Date(row.scheduled_time || row.date),
          plateNumber: row.plate_number || row.plate || null,
          workType: row.work_type || row.type || null,
          normHours: row.norm_hours ? parseFloat(row.norm_hours) : null,
        },
      });
      created.push(order);
    }

    res.status(201).json({ imported: created.length, orders: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/work-orders/{id}/assign:
 *   put:
 *     summary: Assign or move a work order to a post with specific time
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, startTime, endTime]
 *             properties:
 *               postId:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Work order assigned successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Work order not found
 */
router.put('/:id/assign', authenticate, requirePermission('manage_work_orders'), validate(assignSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { postId, startTime, endTime } = req.body;

    const order = await prisma.workOrder.update({
      where: { id },
      data: {
        postId,
        scheduledTime: new Date(startTime),
        estimatedEnd: new Date(endTime),
        status: 'scheduled',
      },
    });

    res.json({ order });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/work-orders/schedule:
 *   post:
 *     summary: Batch update multiple work orders with conflict detection
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignments]
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     workOrderId:
 *                       type: string
 *                     postId:
 *                       type: string
 *                     postNumber:
 *                       type: integer
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Batch update successful with updated count
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Version conflict detected
 */
router.post('/schedule', authenticate, requirePermission('manage_work_orders'), validate(scheduleSchema), async (req, res) => {
  try {
    const { assignments } = req.body;
    const conflicts = [];
    const results = [];

    await prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        const current = await tx.workOrder.findUnique({ where: { id: a.workOrderId } });
        if (!current) { conflicts.push({ workOrderId: a.workOrderId, reason: 'not_found' }); continue; }
        if (a.version !== undefined && a.version !== null && a.version !== current.version) {
          conflicts.push({ workOrderId: a.workOrderId, reason: 'version_mismatch', clientVersion: a.version, serverVersion: current.version, serverData: current });
          continue;
        }
        const updated = await tx.workOrder.update({
          where: { id: a.workOrderId },
          data: { postId: a.postId, postNumber: a.postNumber, scheduledTime: new Date(a.startTime), estimatedEnd: new Date(a.endTime), status: 'scheduled', version: { increment: 1 } },
        });
        results.push(updated);
      }
      if (conflicts.length > 0) throw { type: 'CONFLICTS', conflicts };
    });

    try { const { getIO } = require('../config/socket'); getIO()?.to('all_events').emit('schedule:updated', { count: results.length }); } catch {}
    res.json({ updated: results.length, orders: results });
  } catch (err) {
    if (err.type === 'CONFLICTS') return res.status(409).json({ error: 'conflict', conflicts: err.conflicts, message: 'Some work orders were modified by another user' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/work-orders/{id}/start:
 *   post:
 *     summary: Start a work order
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order started with server time
 *       404:
 *         description: Work order not found
 *       409:
 *         description: Work order already in progress
 */
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!wo) return res.status(404).json({ error: 'Not found' });
    if (wo.status === 'in_progress') return res.status(409).json({ error: 'Already in progress' });
    const now = new Date();
    const estimatedEnd = wo.normHours ? new Date(now.getTime() + wo.normHours * 3600000) : null;
    const order = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status: 'in_progress', startTime: now, estimatedEnd, totalPausedMs: 0, pausedAt: null },
    });
    try { const { getIO } = require('../config/socket'); getIO()?.to('all_events').emit('workOrder:started', { workOrderId: order.id, postNumber: order.postNumber, startTime: now.toISOString() }); } catch {}
    res.json({ order, serverTime: now.toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @openapi
 * /api/work-orders/{id}/pause:
 *   post:
 *     summary: Pause an in-progress work order
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order paused with server time
 *       404:
 *         description: Work order not found
 *       409:
 *         description: Work order cannot be paused (not in progress or already paused)
 */
router.post('/:id/pause', authenticate, async (req, res) => {
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!wo) return res.status(404).json({ error: 'Not found' });
    if (wo.status !== 'in_progress' || wo.pausedAt) return res.status(409).json({ error: 'Cannot pause' });
    const order = await prisma.workOrder.update({ where: { id: req.params.id }, data: { pausedAt: new Date() } });
    res.json({ order, serverTime: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @openapi
 * /api/work-orders/{id}/resume:
 *   post:
 *     summary: Resume a paused work order
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order resumed, estimated end adjusted for pause duration
 *       409:
 *         description: Work order is not paused
 */
router.post('/:id/resume', authenticate, async (req, res) => {
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!wo || !wo.pausedAt) return res.status(409).json({ error: 'Not paused' });
    const pauseDuration = Date.now() - new Date(wo.pausedAt).getTime();
    const newTotalPaused = (wo.totalPausedMs || 0) + pauseDuration;
    const newEstimatedEnd = wo.estimatedEnd ? new Date(new Date(wo.estimatedEnd).getTime() + pauseDuration) : null;
    const order = await prisma.workOrder.update({ where: { id: req.params.id }, data: { pausedAt: null, totalPausedMs: newTotalPaused, estimatedEnd: newEstimatedEnd } });
    res.json({ order, serverTime: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @openapi
 * /api/work-orders/{id}/complete:
 *   post:
 *     summary: Complete a work order and calculate actual hours
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order completed with actual hours calculated
 *       404:
 *         description: Work order not found
 */
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!wo) return res.status(404).json({ error: 'Not found' });
    const now = new Date();
    let totalPaused = wo.totalPausedMs || 0;
    if (wo.pausedAt) totalPaused += now.getTime() - new Date(wo.pausedAt).getTime();
    const actualMs = wo.startTime ? now.getTime() - new Date(wo.startTime).getTime() - totalPaused : 0;
    const order = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status: 'completed', endTime: now, pausedAt: null, totalPausedMs: totalPaused, actualHours: +(actualMs / 3600000).toFixed(2) },
    });
    try { const { getIO } = require('../config/socket'); getIO()?.to('all_events').emit('workOrder:completed', { workOrderId: order.id }); } catch {}
    res.json({ order, serverTime: now.toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
