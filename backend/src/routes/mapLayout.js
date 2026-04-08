const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createMapLayoutSchema, updateMapLayoutSchema } = require('../schemas/mapLayout');

// GET /api/map-layout — get active layout (public, no auth needed)
router.get('/', async (req, res) => {
  try {
    if (req.query.all === 'true') {
      const layouts = await prisma.mapLayout.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      return res.json(layouts);
    }
    // Return the active layout
    const layout = await prisma.mapLayout.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!layout) return res.json(null);
    res.json({ ...layout, elements: JSON.parse(layout.elements || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/map-layout/:id (public)
router.get('/:id', async (req, res) => {
  try {
    const layout = await prisma.mapLayout.findUnique({ where: { id: req.params.id } });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });
    res.json({ ...layout, elements: JSON.parse(layout.elements || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/map-layout — create new layout
router.post('/', authenticate, requirePermission('manage_zones'), validate(createMapLayoutSchema), async (req, res) => {
  try {
    const { name, width, height, bgImage, elements, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // If setting as active, deactivate others
    if (isActive !== false) {
      await prisma.mapLayout.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }

    const layout = await prisma.mapLayout.create({
      data: {
        name,
        width: width || 46540,
        height: height || 30690,
        bgImage: bgImage || null,
        elements: JSON.stringify(elements || []),
        isActive: isActive !== false,
      },
    });
    res.status(201).json({ ...layout, elements: JSON.parse(layout.elements) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/map-layout/:id — update layout (saves previous version)
router.put('/:id', authenticate, requirePermission('manage_zones'), validate(updateMapLayoutSchema), async (req, res) => {
  try {
    // Save current state as a version before updating
    const current = await prisma.mapLayout.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Layout not found' });

    const lastVersion = await prisma.mapLayoutVersion.findFirst({
      where: { layoutId: req.params.id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    await prisma.mapLayoutVersion.create({
      data: {
        layoutId: req.params.id,
        version: nextVersion,
        name: current.name,
        width: current.width,
        height: current.height,
        bgImage: current.bgImage,
        elements: current.elements,
      },
    });

    const { name, width, height, bgImage, elements, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (width !== undefined) data.width = width;
    if (height !== undefined) data.height = height;
    if (bgImage !== undefined) data.bgImage = bgImage;
    if (elements !== undefined) data.elements = JSON.stringify(elements);
    if (isActive !== undefined) {
      data.isActive = isActive;
      if (isActive) {
        await prisma.mapLayout.updateMany({
          where: { isActive: true, id: { not: req.params.id } },
          data: { isActive: false },
        });
      }
    }

    const layout = await prisma.mapLayout.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ ...layout, elements: JSON.parse(layout.elements) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Layout not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/map-layout/:id/versions — list version history
router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await prisma.mapLayoutVersion.findMany({
      where: { layoutId: req.params.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, name: true, createdAt: true },
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/map-layout/:id/restore/:version — restore a version
router.post('/:id/restore/:version', authenticate, requirePermission('manage_zones'), async (req, res) => {
  try {
    const ver = await prisma.mapLayoutVersion.findFirst({
      where: { layoutId: req.params.id, version: parseInt(req.params.version, 10) },
    });
    if (!ver) return res.status(404).json({ error: 'Version not found' });

    // Save current as new version first
    const current = await prisma.mapLayout.findUnique({ where: { id: req.params.id } });
    const lastVersion = await prisma.mapLayoutVersion.findFirst({
      where: { layoutId: req.params.id },
      orderBy: { version: 'desc' },
    });
    await prisma.mapLayoutVersion.create({
      data: {
        layoutId: req.params.id,
        version: (lastVersion?.version || 0) + 1,
        name: current.name,
        width: current.width,
        height: current.height,
        bgImage: current.bgImage,
        elements: current.elements,
      },
    });

    // Restore
    const layout = await prisma.mapLayout.update({
      where: { id: req.params.id },
      data: {
        name: ver.name,
        width: ver.width,
        height: ver.height,
        bgImage: ver.bgImage,
        elements: ver.elements,
      },
    });
    res.json({ ...layout, elements: JSON.parse(layout.elements) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/map-layout/:id
router.delete('/:id', authenticate, requirePermission('manage_zones'), async (req, res) => {
  try {
    await prisma.mapLayout.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Layout not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
