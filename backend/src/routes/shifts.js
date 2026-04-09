const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createShiftSchema, updateShiftSchema } = require('../schemas/shifts');

// GET /api/shifts — list shifts (filter by ?date, ?status, ?week=2026-04-06)
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, status, week } = req.query;
    const where = {};

    if (status) where.status = status;

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (week) {
      const start = new Date(week);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      where.date = { gte: start, lt: end };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { workers: true },
      orderBy: { date: 'asc' },
    });

    res.json({ shifts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/:id — get shift with workers
router.get('/:id', authenticate, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: { workers: true },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Conflict detection ---
async function detectConflicts(date, startTime, endTime, workers, excludeShiftId = null) {
  const conflicts = [];
  // Check for duplicate workers in same shift (different posts)
  const nameMap = {};
  for (const w of (workers || [])) {
    if (nameMap[w.name] && w.postId && nameMap[w.name] !== w.postId) {
      conflicts.push({ type: 'same_shift_duplicate', workerName: w.name, post1: nameMap[w.name], post2: w.postId });
    }
    if (w.postId) nameMap[w.name] = w.postId;
  }
  // Check cross-shift conflicts
  const where = {};
  // Parse date for query
  const d = new Date(date);
  const nextDay = new Date(d);
  nextDay.setDate(nextDay.getDate() + 1);
  where.date = { gte: d, lt: nextDay };
  if (excludeShiftId) where.id = { not: excludeShiftId };
  const existingShifts = await prisma.shift.findMany({ where, include: { workers: true } });
  for (const w of (workers || [])) {
    for (const es of existingShifts) {
      const overlap = startTime < es.endTime && endTime > es.startTime;
      if (overlap && es.workers.some(ew => ew.name === w.name)) {
        conflicts.push({
          type: 'cross_shift_overlap',
          workerName: w.name,
          conflictingShiftName: es.name,
          conflictingTime: `${es.startTime}-${es.endTime}`,
        });
      }
    }
  }
  return conflicts;
}

// POST /api/shifts — create shift
router.post('/', authenticate, requirePermission('manage_shifts'), validate(createShiftSchema), async (req, res) => {
  try {
    const { name, date, startTime, endTime, status, notes, workers } = req.body;

    // Conflict detection
    if (workers && workers.length > 0) {
      const conflicts = await detectConflicts(date, startTime, endTime, workers);
      if (conflicts.length > 0 && !req.body.force) {
        return res.status(409).json({ conflicts });
      }
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        date: new Date(date),
        startTime,
        endTime,
        status: status || 'planned',
        notes: notes || null,
        workers: workers ? {
          create: workers.map(w => ({
            name: w.name,
            role: w.role,
            postId: w.postId || null,
          })),
        } : undefined,
      },
      include: { workers: true },
    });

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shifts/:id — update shift
router.put('/:id', authenticate, requirePermission('manage_shifts'), validate(updateShiftSchema), async (req, res) => {
  try {
    const { name, date, startTime, endTime, status, notes, workers } = req.body;

    // Conflict detection on update
    if (workers && workers.length > 0 && date && startTime && endTime) {
      const conflicts = await detectConflicts(date, startTime, endTime, workers, req.params.id);
      if (conflicts.length > 0 && !req.body.force) {
        return res.status(409).json({ conflicts });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (date !== undefined) data.date = new Date(date);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    // If workers provided, replace all
    if (workers) {
      await prisma.shiftWorker.deleteMany({ where: { shiftId: req.params.id } });
      data.workers = {
        create: workers.map(w => ({
          name: w.name,
          role: w.role,
          postId: w.postId || null,
        })),
      };
    }

    const shift = await prisma.shift.update({
      where: { id: req.params.id },
      data,
      include: { workers: true },
    });

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shifts/:id — delete shift
router.delete('/:id', authenticate, requirePermission('manage_shifts'), async (req, res) => {
  try {
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/complete — complete shift
router.post('/:id/complete', authenticate, requirePermission('manage_shifts'), async (req, res) => {
  try {
    const shift = await prisma.shift.update({
      where: { id: req.params.id },
      data: { status: 'completed' },
      include: { workers: true },
    });

    // Generate handover act data
    const handover = {
      shiftId: shift.id,
      shiftName: shift.name,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      completedAt: new Date().toISOString(),
      workers: shift.workers.map(w => ({
        name: w.name,
        role: w.role,
        postId: w.postId,
      })),
    };

    res.json({ shift, handover });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
