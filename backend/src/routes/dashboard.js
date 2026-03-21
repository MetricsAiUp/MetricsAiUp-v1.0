const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard/overview — общая сводка
router.get('/overview', authenticate, async (req, res) => {
  try {
    const [
      activeSessionsCount,
      zonesWithVehicles,
      postsStatus,
      activeRecommendations,
    ] = await Promise.all([
      // Активные сессии
      prisma.vehicleSession.count({ where: { status: 'active' } }),
      // Зоны с авто
      prisma.zoneStay.groupBy({
        by: ['zoneId'],
        where: { exitTime: null },
        _count: true,
      }),
      // Статусы постов
      prisma.post.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: true,
      }),
      // Активные рекомендации
      prisma.recommendation.count({ where: { status: 'active' } }),
    ]);

    res.json({
      activeSessions: activeSessionsCount,
      zonesWithVehicles,
      postsStatus,
      activeRecommendations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/metrics — метрики по зонам и постам
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    const since = new Date();
    if (period === '24h') since.setHours(since.getHours() - 24);
    else if (period === '7d') since.setDate(since.getDate() - 7);
    else if (period === '30d') since.setDate(since.getDate() - 30);

    const [zoneMetrics, postMetrics, workOrderMetrics] = await Promise.all([
      // Метрики зон: среднее время пребывания
      prisma.zoneStay.groupBy({
        by: ['zoneId'],
        where: { entryTime: { gte: since }, duration: { not: null } },
        _avg: { duration: true },
        _count: true,
      }),
      // Метрики постов: активное время vs простой
      prisma.postStay.groupBy({
        by: ['postId'],
        where: { startTime: { gte: since } },
        _avg: { activeTime: true, idleTime: true },
        _count: true,
      }),
      // ЗН: план vs факт
      prisma.workOrder.groupBy({
        by: ['status'],
        where: { scheduledTime: { gte: since } },
        _count: true,
      }),
    ]);

    res.json({ zoneMetrics, postMetrics, workOrderMetrics, period });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
