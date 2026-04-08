const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

// GET /api/locations — list all locations
router.get('/', authenticate, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: req.query.active === 'true' ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/locations/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const location = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/locations — create (superadmin)
router.post('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { name, address, timezone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const location = await prisma.location.create({
      data: { name, address, timezone },
    });
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/locations/:id
router.put('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { name, address, timezone, isActive } = req.body;
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
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/locations/:id
router.delete('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    await prisma.location.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
