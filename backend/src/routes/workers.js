const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// GET /api/workers - list unique workers
router.get('/', authenticate, async (req, res) => {
  try {
    const workers = await prisma.workOrder.groupBy({ by: ['worker'], where: { worker: { not: null } }, _count: true });
    res.json(workers.map(w => ({ name: w.worker, totalOrders: w._count })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workers/:name/stats
router.get('/:name/stats', authenticate, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { from, to } = req.query;
    const where = { worker: name };
    if (from || to) { where.scheduledTime = {}; if (from) where.scheduledTime.gte = new Date(from); if (to) where.scheduledTime.lte = new Date(to); }

    const orders = await prisma.workOrder.findMany({ where, orderBy: { scheduledTime: 'desc' } });
    const completed = orders.filter(o => o.status === 'completed');
    const totalNorm = orders.reduce((s, o) => s + (o.normHours || 0), 0);
    const totalActual = completed.reduce((s, o) => s + (o.actualHours || 0), 0);

    // Group by workType
    const typeMap = {};
    orders.forEach(o => { if (o.workType) { if (!typeMap[o.workType]) typeMap[o.workType] = { count: 0, normHours: 0 }; typeMap[o.workType].count++; typeMap[o.workType].normHours += o.normHours || 0; } });

    // Group by brand
    const brandMap = {};
    orders.forEach(o => { if (o.brand) { brandMap[o.brand] = (brandMap[o.brand] || 0) + 1; } });

    // Daily stats
    const dailyMap = {};
    orders.forEach(o => {
      const date = o.scheduledTime ? new Date(o.scheduledTime).toISOString().slice(0, 10) : null;
      if (!date) return;
      if (!dailyMap[date]) dailyMap[date] = { date, workOrders: 0, normHours: 0, actualHours: 0 };
      dailyMap[date].workOrders++;
      dailyMap[date].normHours += o.normHours || 0;
      dailyMap[date].actualHours += o.actualHours || 0;
    });

    // Try to get 1C data
    let data1c = [];
    try {
      const raw = fs.readFileSync(path.join(__dirname, '../../../data/1c-workers.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      data1c = (parsed.workers || []).filter(w => w.worker === name || w.name === name);
    } catch {}

    res.json({
      worker: { name, totalOrders: orders.length },
      summary: {
        totalWorkOrders: orders.length, completedWorkOrders: completed.length,
        totalNormHours: +totalNorm.toFixed(1), totalActualHours: +totalActual.toFixed(1),
        avgEfficiency: totalActual > 0 ? +((totalNorm / totalActual) * 100).toFixed(1) : 0,
      },
      topRepairTypes: Object.entries(typeMap).map(([type, d]) => ({ type, count: d.count, normHours: +d.normHours.toFixed(1) })).sort((a, b) => b.count - a.count).slice(0, 10),
      topBrands: Object.entries(brandMap).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      dailyStats: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
      recentOrders: orders.slice(0, 15).map(o => ({ id: o.id, number: o.orderNumber, workType: o.workType, brand: o.brand, model: o.model, normHours: o.normHours, status: o.status, scheduledTime: o.scheduledTime })),
      data1c,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
