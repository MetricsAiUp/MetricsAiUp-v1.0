const router = require('express').Router();
const prisma = require('../config/database');
const settingsReader = require('./settings');

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

// Helper: generate calendar data (last 30 days) for a post
function computeCalendar(postWOs) {
  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    // Weekend — lower load
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayWOs = postWOs.filter(w => {
      const ws = w.scheduledTime || w.startTime;
      return ws && ws.toISOString().slice(0, 10) === dateStr;
    });
    const completed = dayWOs.filter(w => w.status === 'completed').length;
    const totalHours = dayWOs.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    // For days without real data, generate plausible demo values
    const vehicles = dayWOs.length > 0 ? dayWOs.length : (isWeekend ? 0 : Math.floor(2 + Math.random() * 4));
    const hours = totalHours > 0 ? Math.round(totalHours * 10) / 10 : (isWeekend ? 0 : Math.round((2 + Math.random() * 6) * 10) / 10);
    cal.push({
      date: dateStr,
      vehicles,
      completedOrders: dayWOs.length > 0 ? completed : (isWeekend ? 0 : Math.floor(1 + Math.random() * 3)),
      totalHours: hours,
      loadPercent: isWeekend ? 0 : Math.min(100, Math.round((hours / 12) * 100)),
    });
  }
  return cal;
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
    // In live mode — return monitoring data
    const curSettings = settingsReader.readSettings();
    const proxy = req.app.get('monitoringProxy');
    if (curSettings.mode === 'live' && proxy && proxy.isRunning()) {
      const monPosts = proxy.getPosts();
      const result = monPosts.map(mp => {
        const history = mp.history || [];
        // Build daily stats from history
        const occupiedEntries = history.filter(h => h.status === 'occupied');
        const freeEntries = history.filter(h => h.status === 'free');

        return {
          id: `post-${mp.postNumber}`,
          number: mp.postNumber,
          name: `Пост ${mp.postNumber}`,
          type: POST_TYPES[mp.postNumber] || 'light',
          zone: mp.externalZoneName,
          status: mp.status,
          maxCapacityHours: 12,
          occupancy: mp.status !== 'free' ? Math.round(50 + Math.random() * 40) : 0,
          efficiency: 0,
          vehiclesToday: occupiedEntries.length,
          avgServiceTime: 0,
          totalNormHours: 0,
          totalActualHours: 0,
          completedWOs: freeEntries.length,
          scheduledWOs: 0,
          workerPresence: mp.peopleCount > 0 ? 100 : 0,
          worker: null,
          master: null,
          today: {
            factHours: 0,
            planHours: 0,
            loadPercent: mp.status !== 'free' ? 50 : 0,
            workers: [],
            workOrders: [],
            alerts: [],
            eventLog: history.map((h, i) => ({
              id: `evt-${mp.postNumber}-${i}`,
              timestamp: h.timestamp,
              type: h.status === 'occupied' ? 'post_occupied' : 'post_vacated',
              description: h.worksInProgress ? 'Работы ведутся' : (h.status === 'occupied' ? 'Авто на посту' : 'Пост свободен'),
              plate: h.car?.plate || null,
              car: h.car || null,
              confidence: h.confidence,
              peopleCount: h.peopleCount,
            })),
            workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 },
            cameras: [{ id: `cam-post${mp.postNumber}`, name: `Камера пост ${mp.postNumber}`, online: true }],
            currentPlateImage: null,
            // Live-specific fields
            currentVehicle: mp.status !== 'free' ? {
              plateNumber: mp.plateNumber,
              color: mp.carColor,
              model: mp.carModel,
              make: mp.carMake,
              body: mp.carBody,
              firstSeen: mp.carFirstSeen,
            } : null,
            worksDescription: mp.worksDescription,
            peopleCount: mp.peopleCount,
            openParts: mp.openParts,
            confidence: mp.confidence,
          },
          daily: [],
          calendar: [],
          workOrders: [],
        };
      });
      // Also add zones
      const monZones = proxy.getFreeZones();
      const zones = monZones.map(mz => {
        const history = mz.history || [];
        return {
          id: `zone-${mz.zoneNumber}`,
          number: mz.zoneNumber,
          name: `Зона ${String(mz.zoneNumber).padStart(2, '0')}`,
          type: 'zone',
          zone: mz.externalZoneName,
          status: mz.status === 'occupied' ? (mz.worksInProgress ? 'active_work' : 'occupied') : 'free',
          maxCapacityHours: 12,
          occupancy: mz.status === 'occupied' ? 50 : 0,
          efficiency: 0,
          vehiclesToday: history.filter(h => h.status === 'occupied').length,
          avgServiceTime: 0,
          totalNormHours: 0,
          totalActualHours: 0,
          completedWOs: history.filter(h => h.status === 'free').length,
          scheduledWOs: 0,
          workerPresence: mz.peopleCount > 0 ? 100 : 0,
          worker: null,
          master: null,
          today: {
            factHours: 0,
            planHours: 0,
            loadPercent: mz.status === 'occupied' ? 50 : 0,
            workers: [],
            workOrders: [],
            alerts: [],
            eventLog: history.map((h, i) => ({
              id: `evt-z${mz.zoneNumber}-${i}`,
              timestamp: h.timestamp,
              type: h.status === 'occupied' ? 'post_occupied' : 'post_vacated',
              description: h.worksInProgress ? 'Работы ведутся' : (h.status === 'occupied' ? 'Авто в зоне' : 'Зона свободна'),
              plate: h.car?.plate || null,
              car: h.car || null,
              confidence: h.confidence,
              peopleCount: h.peopleCount,
            })),
            workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 },
            cameras: [],
            currentVehicle: mz.status === 'occupied' ? {
              plateNumber: mz.plateNumber,
              color: mz.carColor,
              model: mz.carModel,
              make: mz.carMake,
              body: mz.carBody,
              firstSeen: mz.carFirstSeen,
            } : null,
            worksDescription: mz.worksDescription,
            peopleCount: mz.peopleCount,
            openParts: mz.openParts,
            confidence: mz.confidence,
          },
          daily: [],
          calendar: [],
          workOrders: [],
        };
      });

      return res.json({ posts: result, zones, mode: 'live' });
    }

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
        cameras: [
          { id: `cam-post${num}`, name: `Камера пост ${num}`, online: true },
        ],
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
        calendar: computeCalendar(postWOs),
        workOrders: postWOs.slice(-20).map(w => ({
          id: w.id, orderNumber: w.orderNumber, plateNumber: w.plateNumber,
          brand: w.brand, model: w.model, workType: w.workType,
          normHours: w.normHours, actualHours: w.actualHours,
          status: w.status, startTime: w.startTime, endTime: w.endTime,
          worker: w.worker, master: w.master,
        })),
      });
    }

    // Add placeholder zones for demo mode (basic info from DB)
    const dbZones = await prisma.zone.findMany({
      where: { isActive: true, type: 'free' },
      include: { _count: { select: { stays: { where: { exitTime: null } } } } },
      orderBy: { name: 'asc' },
    });
    const zones = [];
    for (let num = 1; num <= 7; num++) {
      const dbZ = dbZones.find(z => {
        const n = parseInt(z.name?.match(/\d+/)?.[0], 10);
        return n === num;
      });
      zones.push({
        id: `zone-${num}`,
        number: num,
        name: `Зона ${String(num).padStart(2, '0')}`,
        type: 'zone',
        zone: dbZ?.name || `Свободная зона ${String(num).padStart(2, '0')}`,
        status: dbZ && dbZ._count?.stays > 0 ? 'occupied' : 'free',
        maxCapacityHours: 12,
        occupancy: 0,
        efficiency: 0,
        vehiclesToday: 0,
        avgServiceTime: 0,
        totalNormHours: 0, totalActualHours: 0,
        completedWOs: 0, scheduledWOs: 0,
        workerPresence: 0, worker: null, master: null,
        today: { factHours: 0, planHours: 0, loadPercent: 0, workers: [], workOrders: [], alerts: [], eventLog: [], workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 }, cameras: [], currentVehicle: null, worksDescription: null, peopleCount: 0, openParts: [], confidence: null },
        daily: [], calendar: [], workOrders: [],
      });
    }

    res.json({ posts: result, zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-posts — timeline data for posts Gantt view
router.get('/dashboard-posts', async (req, res) => {
  try {
    // In live mode — return data from monitoring proxy
    const settings = settingsReader.readSettings();
    const proxy = req.app.get('monitoringProxy');
    if (settings.mode === 'live' && proxy && proxy.isRunning()) {
      const monPosts = proxy.getPosts();
      const posts = monPosts.map(mp => {
        // Build timeline from history
        const timeline = (mp.history || []).map((h, idx) => ({
          id: `mon-${mp.postNumber}-${idx}`,
          workOrderNumber: null,
          workOrderId: null,
          plateNumber: h.car?.plate || null,
          brand: h.car?.make || null,
          model: h.car?.model || null,
          workType: h.worksInProgress ? 'monitoring' : null,
          status: h.status === 'occupied' && h.worksInProgress ? 'in_progress' : h.status === 'occupied' ? 'scheduled' : 'completed',
          startTime: h.timestamp,
          endTime: null,
          normHours: null,
          master: null,
          worker: null,
          actualHours: null,
          estimatedEnd: null,
          confidence: h.confidence,
          peopleCount: h.peopleCount,
          worksDescription: null,
        }));

        const currentVehicle = mp.status !== 'free' && (mp.plateNumber || mp.carModel)
          ? { plateNumber: mp.plateNumber, brand: mp.carMake, model: mp.carModel, color: mp.carColor }
          : null;

        return {
          id: `post-${mp.postNumber}`,
          number: mp.postNumber,
          name: `Пост ${mp.postNumber}`,
          type: POST_TYPES[mp.postNumber] || 'light',
          zone: mp.externalZoneName,
          status: mp.status,
          currentVehicle,
          worksDescription: mp.worksDescription,
          peopleCount: mp.peopleCount,
          openParts: mp.openParts,
          confidence: mp.confidence,
          lastUpdate: mp.lastUpdate,
          timeline,
          freeWorkOrders: [],
        };
      });

      return res.json({
        settings: { shiftStart: '08:00', shiftEnd: '20:00', postsCount: 10, mode: 'live' },
        posts,
        freeWorkOrders: [],
      });
    }

    // Demo mode — original DB logic
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

// ─── GET /api/analytics-history — 30-day per-post analytics ───
// Generated deterministically (seeded random) so it's consistent within a day.
router.get('/analytics-history', async (req, res) => {
  try {
    const crypto = require('crypto');
    function uuidSeed(seed) {
      return crypto.createHash('md5').update(String(seed)).digest('hex');
    }

    const MOSCOW_OFFSET_MS = 3 * 60 * 60000;
    const _now = new Date();
    const NOW = new Date(_now.getTime() + (MOSCOW_OFFSET_MS + _now.getTimezoneOffset() * 60000));
    const TODAY_BASE = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

    let _s = Math.floor(TODAY_BASE.getTime() / 86400000);
    function sr() { _s = (_s * 16807 + 0) % 2147483647; return (_s - 1) / 2147483646; }
    function rb(min, max) { return min + sr() * (max - min); }
    function rt(n, d = 1) { return Math.round(n * (10 ** d)) / (10 ** d); }

    const WORKERS_NAMES = [
      'Павлович Сергей Леонидович', 'Романовский Денис Сергеевич',
      'Филипеня Павел Григорьевич', 'Кондратенко Андрей Станиславович',
      'Бортник Ярослав Константинович', 'Кендыш Александр Иванович',
      'Швец Алексей Богданович', 'Воропай Александр Антонович',
      'Бобров Александр Владимирович', 'Косачук Антон Николаевич',
    ];
    const MASTERS_NAMES = ['Крылатов Максим Геннадьевич', 'Эксузьян Андроник Андроникович', 'Прижилуцкий Юрий Анатольевич'];

    function hourlyLoadBase(h, isWeekend) {
      const curve = { 8: 0.35, 9: 0.55, 10: 0.78, 11: 0.85, 12: 0.75, 13: 0.55, 14: 0.72, 15: 0.80, 16: 0.70, 17: 0.55, 18: 0.40, 19: 0.25 };
      return (curve[h] || 0.3) * (isWeekend ? 0.4 : 1.0);
    }

    const postTraits = Array.from({ length: 10 }, (_, i) => ({
      occBase: 0.55 + (i % 3) * 0.1,
      effBase: 0.60 + ((i + 1) % 4) * 0.08,
      vehicleBase: i < 8 ? 4 : 3,
    }));

    const postTypes = { 0: 'heavy', 1: 'heavy', 2: 'heavy', 3: 'heavy', 4: 'light', 5: 'light', 6: 'light', 7: 'light', 8: 'special', 9: 'special' };

    const posts = Array.from({ length: 10 }, (_, pi) => {
      const trait = postTraits[pi];
      const num = pi + 1;
      const days = [];

      for (let d = 29; d >= 0; d--) {
        const day = new Date(TODAY_BASE);
        day.setDate(day.getDate() - d);
        const dateStr = day.toISOString().split('T')[0];
        const dow = day.getDay();
        const isWeekend = dow === 0 || dow === 6;

        const dayNoise = rb(-0.1, 0.1);
        const occ = Math.max(0.05, Math.min(0.98, trait.occBase + dayNoise + (isWeekend ? -0.3 : 0)));
        const eff = Math.max(0.3, Math.min(0.98, trait.effBase + rb(-0.08, 0.08) + (isWeekend ? -0.15 : 0)));
        const vehicles = isWeekend ? Math.max(1, Math.floor(trait.vehicleBase * 0.4 + rb(0, 1))) : Math.floor(trait.vehicleBase + rb(-1, 2));
        const activeMin = rt(vehicles * rb(60, 120), 0);
        const idleMin = rt(vehicles * rb(10, 40), 0);
        const avgTime = vehicles > 0 ? Math.round(rb(45, 150)) : 0;
        const avgWait = Math.round(rb(5, 35));
        const workerPres = Math.max(0.5, Math.min(1, eff + rb(-0.05, 0.1)));
        const plannedOrders = vehicles + Math.floor(rb(0, 2));
        const completedOrders = Math.max(0, vehicles - Math.floor(rb(0, 1)));
        const noShows = isWeekend ? 0 : (sr() > 0.8 ? 1 : 0);
        const plannedH = rt(vehicles * rb(1.5, 2.5), 1);
        const actualH = rt(plannedH * rb(0.85, 1.2), 1);

        const hourly = [];
        for (let h = 8; h <= 19; h++) {
          const baseOcc = hourlyLoadBase(h, isWeekend);
          const postOcc = Math.max(0, Math.min(1, baseOcc + (occ - 0.5) * 0.3 + rb(-0.1, 0.1)));
          hourly.push({ hour: h, occupancy: rt(postOcc, 3), vehicles: postOcc > 0.5 ? 1 : (sr() > 0.5 ? 1 : 0) });
        }

        days.push({
          date: dateStr, occupancyRate: rt(occ, 3), efficiency: rt(eff, 3),
          vehicleCount: vehicles, avgTimePerVehicle: avgTime, avgWaitTime: avgWait,
          activeMinutes: activeMin, idleMinutes: idleMin, workerPresence: rt(workerPres, 3),
          plannedOrders, completedOrders, noShows, plannedHours: plannedH, actualHours: actualH, hourly,
        });
      }

      return {
        id: `post-${num}`, name: `Пост ${String(num).padStart(2, '0')}`, nameEn: `Post ${num}`,
        type: postTypes[pi] || 'light',
        worker: WORKERS_NAMES[pi % WORKERS_NAMES.length],
        master: MASTERS_NAMES[pi % MASTERS_NAMES.length],
        days,
      };
    });

    const daily = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(TODAY_BASE);
      day.setDate(day.getDate() - d);
      const dateStr = day.toISOString().split('T')[0];
      let totalVehicles = 0, totalNoShows = 0;
      posts.forEach(p => {
        const dd = p.days.find(dd => dd.date === dateStr);
        if (dd) { totalVehicles += dd.vehicleCount; totalNoShows += dd.noShows; }
      });
      daily.push({ date: dateStr, totalVehicles, totalNoShows });
    }

    res.json({ posts, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
