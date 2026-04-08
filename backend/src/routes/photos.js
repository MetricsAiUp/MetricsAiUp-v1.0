const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '../../../data/photos');

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// POST /api/photos — upload photo (base64 in body)
router.post('/', authenticate, async (req, res) => {
  try {
    const { sessionId, workOrderId, image, filename } = req.body;
    if (!image) return res.status(400).json({ error: 'No image data' });

    // Decode base64
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format' });

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const fname = filename || `photo-${Date.now()}.${ext}`;

    // Create session directory
    const dir = sessionId ? path.join(PHOTOS_DIR, sessionId) : PHOTOS_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, fname);
    fs.writeFileSync(filePath, buffer);

    const relativePath = sessionId ? `photos/${sessionId}/${fname}` : `photos/${fname}`;

    const photo = await prisma.photo.create({
      data: {
        sessionId: sessionId || null,
        workOrderId: workOrderId || null,
        path: relativePath,
        filename: fname,
        mimeType,
      },
    });

    res.status(201).json(photo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/photos?sessionId=xxx or ?workOrderId=xxx
router.get('/', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.query.sessionId) where.sessionId = req.query.sessionId;
    if (req.query.workOrderId) where.workOrderId = req.query.workOrderId;

    const photos = await prisma.photo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/photos/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    // Delete file
    const filePath = path.join(__dirname, '../../../data', photo.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.photo.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
