const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     summary: List vehicle sessions with zone and post stays
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: active
 *         description: Filter by session status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Max number of sessions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Paginated list of sessions with total count
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status = 'active', limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      prisma.vehicleSession.findMany({
        where,
        include: {
          zoneStays: {
            include: { zone: true },
            orderBy: { entryTime: 'desc' },
          },
          postStays: {
            include: { post: true },
            orderBy: { startTime: 'desc' },
          },
        },
        orderBy: { entryTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.vehicleSession.count({ where }),
    ]);

    res.json({ sessions, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/sessions/{id}:
 *   get:
 *     summary: Get session by ID with full details
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session with zone stays, post stays, work order links, and events
 *       404:
 *         description: Session not found
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await prisma.vehicleSession.findUnique({
      where: { id: req.params.id },
      include: {
        zoneStays: { include: { zone: true }, orderBy: { entryTime: 'asc' } },
        postStays: { include: { post: true }, orderBy: { startTime: 'asc' } },
        workOrderLinks: { include: { workOrder: true } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
