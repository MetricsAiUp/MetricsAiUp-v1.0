const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { importCsvSchema, assignSchema, scheduleSchema } = require('../schemas/workOrders');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

// GET /api/work-orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = status;

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

// POST /api/work-orders/import-csv — импорт из CSV
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

// PUT /api/work-orders/:id/assign — assign/move a work order to a post with specific time
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

// POST /api/work-orders/schedule — batch update multiple work orders
router.post('/schedule', authenticate, requirePermission('manage_work_orders'), validate(scheduleSchema), async (req, res) => {
  try {
    const { assignments } = req.body;
    const results = [];

    for (const assignment of assignments) {
      const order = await prisma.workOrder.update({
        where: { id: assignment.workOrderId },
        data: {
          postId: assignment.postId,
          scheduledTime: new Date(assignment.startTime),
          estimatedEnd: new Date(assignment.endTime),
          status: 'scheduled',
        },
      });
      results.push(order);
    }

    res.json({ updated: results.length, orders: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
