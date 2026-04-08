const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const VALID_TIMEZONES = ['Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'UTC'];

// GET /api/locations
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const locations = await prisma.location.findMany({
    where: req.query.active === 'true' ? { isActive: true } : {},
    orderBy: { name: 'asc' },
  });
  res.json(locations);
}));

// GET /api/locations/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const location = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!location) return res.status(404).json({ error: 'Location not found' });
  res.json(location);
}));

// POST /api/locations
router.post('/', authenticate, requirePermission('manage_users'), asyncHandler(async (req, res) => {
  const { name, address, timezone } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (timezone && !VALID_TIMEZONES.includes(timezone)) {
    return res.status(400).json({ error: 'Invalid timezone' });
  }
  const location = await prisma.location.create({
    data: { name, address, timezone: timezone || 'Europe/Moscow' },
  });
  res.status(201).json(location);
}));

// PUT /api/locations/:id
router.put('/:id', authenticate, requirePermission('manage_users'), asyncHandler(async (req, res) => {
  const { name, address, timezone, isActive } = req.body;
  if (timezone && !VALID_TIMEZONES.includes(timezone)) {
    return res.status(400).json({ error: 'Invalid timezone' });
  }
  const data = {};
  if (name !== undefined) data.name = name;
  if (address !== undefined) data.address = address;
  if (timezone !== undefined) data.timezone = timezone;
  if (isActive !== undefined) data.isActive = isActive;

  const location = await prisma.location.update({
    where: { id: req.params.id },
    data,
  });
  res.json(location);
}));

// DELETE /api/locations/:id
router.delete('/:id', authenticate, requirePermission('manage_users'), asyncHandler(async (req, res) => {
  await prisma.location.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted', id: req.params.id });
}));

module.exports = router;
