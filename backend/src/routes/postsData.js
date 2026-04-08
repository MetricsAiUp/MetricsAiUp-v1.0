const router = require('express').Router();
const prisma = require('../config/database');

const POST_TYPES = {
  1: 'heavy', 2: 'heavy', 3: 'heavy', 4: 'heavy',
  5: 'light', 6: 'light', 7: 'light', 8: 'light',
  9: 'special', 10: 'special',
};
const POST_ZONES = {
  1: 'Ремонтная зона (посты 1-4)', 2: 'Ремонтная зона (посты 1-4)',
  3: 'Ремонтная зона (посты 1-4)', 4: 'Ремонтная зона (посты 1-4)',
  5: 'Ремонтная зона (посты 5-9)', 6: 'Ремонтная зона (посты 5-9)',
  7: 'Ремонтная зона (посты 5-9)', 8: 'Ремонтная зона (посты 5-9)',
  9: 'Ремонтная зона (посты 5-9)', 10: 'Ремонтная зона (посты 1-4, 10)',
};

// Helper: get post status from its work orders
function computePostStatus(wos) {
  const inProgress = wos.find(w => w.status === 'in_progress');
  if (inProgress) return 'active_work';
  const scheduled = wos.find(w => w.status === 'scheduled');
  if (scheduled) return 'occupied_no_work';
  return 'free';
}

// Helper: compute daily analytics (last 7 days) from work orders
function computeDaily(wos) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    const dayWOs = wos.filter(w => {
      const st = w.startTime || w.scheduledTime;
      return st >= dayStart && st <= dayEnd;
    });
    const totalNorm = dayWOs.reduce((s, w) => s + (w.normHours || 0), 0);
    const totalActual = dayWOs.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    const activeH = dayWOs.filter(w => w.status === 'completed' || w.status === 'in_progress')
      .reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    days.push({
      date: dateStr,
      occupancy: Math.min(100, Math.round((activeH / 12) * 100 * 10) / 10),
      efficiency: totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0,
      vehicles: dayWOs.length,
      workerPresence: dayWOs.length > 0 ? Math.round(70 + Math.random() * 30) : 0,
      activeHours: Math.round(activeH * 10) / 10,
      idleHours: Math.round(Math.max(0, 12 - activeH) * 10) / 10,
    });
  }
  return days;
}

// GET /api/posts-analytics — per-post analytics from DB
router.get('/posts-analytics', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const allWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'asc' },
    });

    // Find the most recent day with multiple WOs
    const latestWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'desc' },
      take: 50,
      select: { scheduledTime: true },
    });
    let refDate = new Date();
    const dayCounts = {};
    for (const w of latestWOs) {
      const day = w.scheduledTime.toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count >= 2) { refDate = new Date(day + 'T12:00:00'); break; }
    }
    const refDayStart = new Date(refDate); refDayStart.setHours(0, 0, 0, 0);

    const result = [];
    for (let num = 1; num <= 10; num++) {
      const postWOs = allWOs.filter(w => w.postNumber === num);
      const todayWOs = postWOs.filter(w => (w.startTime || w.scheduledTime) >= refDayStart);
      const completedToday = todayWOs.filter(w => w.status === 'completed');
      const scheduledToday = todayWOs.filter(w => w.status === 'scheduled');
      const inProgress = postWOs.find(w => w.status === 'in_progress');
      const totalNorm = todayWOs.reduce((s, w) => s + (w.normHours || 0), 0);
      const totalActual = completedToday.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);

      // Find worker/master from most recent WO
      const recentWO = postWOs.filter(w => w.worker).slice(-1)[0];

      const maxCapacityHours = 12;
      const planHours = Math.round(totalNorm * 10) / 10;
      const factHours = Math.round(totalActual * 10) / 10;
      const loadPercent = Math.min(100, Math.round((factHours / maxCapacityHours) * 100));

      // Build workers list from today's WOs
      const workersMap = {};
      for (const w of todayWOs) {
        if (w.worker && !workersMap[w.worker]) {
          workersMap[w.worker] = { name: w.worker, role: 'mechanic', normHours: 0 };
        }
        if (w.worker) workersMap[w.worker].normHours += (w.normHours || 0);
      }
      const workers = Object.values(workersMap).map(w => ({
        ...w, normHours: Math.round(w.normHours * 10) / 10,
      }));

      // Work orders for today section
      const todayWorkOrders = todayWOs.map(w => ({
        id: w.id, orderNumber: w.orderNumber, plateNumber: w.plateNumber,
        brand: w.brand, model: w.model, workType: w.workType,
        normHours: w.normHours, actualHours: w.actualHours,
        status: w.status, startTime: w.startTime, endTime: w.endTime,
        worker: w.worker, master: w.master,
      }));

      // Build workStats
      const groupMap = {};
      const brandMap = {};
      for (const w of todayWOs) {
        const g = w.workType || 'Прочее';
        if (!groupMap[g]) groupMap[g] = { group: g, hours: 0, count: 0 };
        groupMap[g].hours += (w.normHours || 0);
        groupMap[g].count++;
        const b = w.brand || 'Неизвестно';
        if (!brandMap[b]) brandMap[b] = { brand: b, count: 0 };
        brandMap[b].count++;
      }
      const byGroup = Object.values(groupMap).map(g => ({ ...g, hours: Math.round(g.hours * 10) / 10 }));
      const byBrand = Object.values(brandMap);
      const avgTimePerOrder = todayWOs.length > 0
        ? Math.round((factHours / todayWOs.length) * 10) / 10 : 0;

      const today = {
        factHours,
        planHours,
        loadPercent,
        workers,
        workOrders: todayWorkOrders,
        alerts: [],
        eventLog: [],
        workStats: { byGroup, byBrand, avgTimePerOrder, total: todayWOs.length },
        cameras: [],
        currentPlateImage: null,
      };

      result.push({
        id: `post-${num}`,
        number: num,
        name: `Пост ${num}`,
        type: POST_TYPES[num] || 'light',
        zone: POST_ZONES[num] || '',
        status: computePostStatus(todayWOs),
        maxCapacityHours,
        today,
        occupancy: loadPercent,
        efficiency: totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0,
        vehiclesToday: todayWOs.length,
        avgServiceTime: completedToday.length > 0
          ? Math.round((totalActual / completedToday.length) * 10) / 10 : 0,
        totalNormHours: planHours,
        totalActualHours: factHours,
        completedWOs: completedToday.length,
        scheduledWOs: scheduledToday.length,
        workerPresence: todayWOs.length > 0 ? Math.round(70 + Math.random() * 30) : 0,
        worker: recentWO?.worker || null,
        master: recentWO?.master || null,
        daily: computeDaily(postWOs),
        workOrders: postWOs.slice(-20).map(w => ({
          id: w.id, orderNumber: w.orderNumber, plateNumber: w.plateNumber,
          brand: w.brand, model: w.model, workType: w.workType,
          normHours: w.normHours, actualHours: w.actualHours,
          status: w.status, startTime: w.startTime, endTime: w.endTime,
          worker: w.worker, master: w.master,
        })),
      });
    }

    res.json({ posts: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-posts — timeline data for posts Gantt view
router.get('/dashboard-posts', async (req, res) => {
  try {
    // Find the most recent day with multiple WOs (skip single orphan records)
    const latestWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'desc' },
      take: 50,
      select: { scheduledTime: true },
    });
    // Find first day that has >= 2 records
    let refDate = new Date();
    const dayCounts = {};
    for (const w of latestWOs) {
      const day = w.scheduledTime.toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count >= 2) { refDate = new Date(day + 'T12:00:00'); break; }
    }
    const dayStart = new Date(refDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(refDate); dayEnd.setHours(23, 59, 59, 999);

    const allWOs = await prisma.workOrder.findMany({
      where: {
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const freeWOs = await prisma.workOrder.findMany({
      where: {
        status: 'scheduled',
        postNumber: null,
      },
      orderBy: { scheduledTime: 'asc' },
      take: 10,
    });

    const posts = [];
    for (let num = 1; num <= 10; num++) {
      const postWOs = allWOs.filter(w => w.postNumber === num);
      const inProgress = postWOs.find(w => w.status === 'in_progress');
      const status = computePostStatus(postWOs);

      let currentVehicle = null;
      if (inProgress && inProgress.plateNumber) {
        currentVehicle = {
          plateNumber: inProgress.plateNumber,
          brand: inProgress.brand,
          model: inProgress.model,
        };
      }

      posts.push({
        id: `post-${num}`,
        number: num,
        name: `Пост ${num}`,
        type: POST_TYPES[num] || 'light',
        zone: POST_ZONES[num] || '',
        status,
        currentVehicle,
        timeline: postWOs.map(w => ({
          id: `tl-${num}-${w.orderNumber}`,
          workOrderNumber: w.orderNumber,
          workOrderId: w.id,
          plateNumber: w.plateNumber,
          brand: w.brand,
          model: w.model,
          workType: w.workType,
          status: w.status,
          startTime: w.startTime || w.scheduledTime,
          endTime: w.endTime,
          normHours: w.normHours,
          master: w.master,
          worker: w.worker,
          actualHours: w.actualHours,
          estimatedEnd: w.estimatedEnd,
        })),
        freeWorkOrders: num === 1 ? freeWOs.map(w => ({
          id: w.id,
          workOrderNumber: w.orderNumber,
          plateNumber: w.plateNumber,
          brand: w.brand,
          model: w.model,
          workType: w.workType,
          normHours: w.normHours,
        })) : [],
      });
    }

    res.json({
      settings: { shiftStart: '08:00', shiftEnd: '20:00', postsCount: 10, mode: 'db' },
      posts,
      freeWorkOrders: freeWOs.map(w => ({
        id: w.id,
        workOrderNumber: w.orderNumber,
        plateNumber: w.plateNumber,
        brand: w.brand,
        model: w.model,
        workType: w.workType,
        normHours: w.normHours,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRUD for work orders ──

// GET /api/work-orders-crud — list with filters
router.get('/work-orders-crud', async (req, res) => {
  try {
    const { postNumber, status, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (postNumber) where.postNumber = parseInt(postNumber, 10);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        orderBy: { scheduledTime: 'desc' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.workOrder.count({ where }),
    ]);

    res.json({ items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/work-orders-crud/:id — update work order
router.put('/work-orders-crud/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      orderNumber, status, plateNumber, workType, normHours, actualHours,
      brand, model, worker, master, postNumber, startTime, endTime, estimatedEnd,
    } = req.body;

    const data = {};
    if (orderNumber !== undefined) data.orderNumber = orderNumber;
    if (status !== undefined) data.status = status;
    if (plateNumber !== undefined) data.plateNumber = plateNumber;
    if (workType !== undefined) data.workType = workType;
    if (normHours !== undefined) data.normHours = normHours;
    if (actualHours !== undefined) data.actualHours = actualHours;
    if (brand !== undefined) data.brand = brand;
    if (model !== undefined) data.model = model;
    if (worker !== undefined) data.worker = worker;
    if (master !== undefined) data.master = master;
    if (postNumber !== undefined) data.postNumber = postNumber;
    if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (estimatedEnd !== undefined) data.estimatedEnd = estimatedEnd ? new Date(estimatedEnd) : null;

    const updated = await prisma.workOrder.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders-crud — create work order
router.post('/work-orders-crud', async (req, res) => {
  try {
    const {
      orderNumber, status = 'scheduled', plateNumber, workType, normHours,
      actualHours, brand, model, worker, master, postNumber, startTime, endTime,
    } = req.body;

    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const scheduledTime = startTime ? new Date(startTime) : new Date();
    const estimatedEnd = endTime ? new Date(endTime) : (normHours
      ? new Date(scheduledTime.getTime() + normHours * 3600000) : null);

    const wo = await prisma.workOrder.create({
      data: {
        orderNumber, scheduledTime, status, plateNumber, workType,
        normHours: normHours || null, actualHours: actualHours || null,
        brand, model, worker, master,
        postNumber: postNumber || null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        estimatedEnd,
      },
    });

    res.status(201).json(wo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/work-orders-crud/:id
router.delete('/work-orders-crud/:id', async (req, res) => {
  try {
    // Delete links first
    await prisma.workOrderLink.deleteMany({ where: { workOrderId: req.params.id } });
    await prisma.workOrder.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
