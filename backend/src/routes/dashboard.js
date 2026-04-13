const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * @openapi
 * /api/dashboard/overview:
 *   get:
 *     summary: Get general STO overview (sessions, zones, posts, recommendations)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview data with active sessions, zone vehicles, post statuses, recommendations count
 */
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

/**
 * @openapi
 * /api/dashboard/metrics:
 *   get:
 *     summary: Get zone and post metrics for a given period
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for metrics aggregation
 *     responses:
 *       200:
 *         description: Zone metrics, post metrics, and work order metrics
 */
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

/**
 * @openapi
 * /api/dashboard/trends:
 *   get:
 *     summary: Get 7-day trend data for sparklines
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of daily trend data (sessions, post stays, occupied posts, recommendations)
 */
router.get('/trends', authenticate, async (req, res) => {
  try {
    const days = 7;
    const results = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const [sessions, postStays, occupiedPosts, recs] = await Promise.all([
        prisma.vehicleSession.count({ where: { entryTime: { gte: dayStart, lt: dayEnd } } }),
        prisma.postStay.count({ where: { startTime: { gte: dayStart, lt: dayEnd } } }),
        prisma.postStay.groupBy({ by: ['postId'], where: { startTime: { gte: dayStart, lt: dayEnd } } }).then(g => g.length),
        prisma.recommendation.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
      ]);
      results.push({ date: dayStart.toISOString().slice(0, 10), activeSessions: sessions, postStays, occupiedPosts, recommendations: recs });
    }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @openapi
 * /api/dashboard/live:
 *   get:
 *     summary: Get real-time STO status with post details
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Live data with vehicles on site, post statuses, and summary counts
 */
router.get('/live', authenticate, async (req, res) => {
  try {
    const activeSessions = await prisma.vehicleSession.count({ where: { status: 'active' } });
    const posts = await prisma.post.findMany({
      where: { isActive: true },
      include: {
        zone: { select: { name: true } },
        stays: {
          where: { endTime: null },
          include: { vehicleSession: { select: { plateNumber: true } } },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    const totalPosts = posts.length;
    const working = posts.filter(p => p.status === 'active_work').length;
    const occupied = posts.filter(p => p.status !== 'free').length;
    const free = posts.filter(p => p.status === 'free').length;
    const idle = posts.filter(p => p.status === 'occupied_no_work').length;
    res.json({
      vehiclesOnSite: activeSessions,
      totalPosts,
      posts: posts.map(p => ({
        id: p.id,
        name: p.name,
        zone: p.zone?.name,
        status: p.status,
        plateNumber: p.stays[0]?.vehicleSession?.plateNumber || null,
        startTime: p.stays[0]?.startTime?.toISOString() || null,
      })),
      summary: { working, occupied, free, idle },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
