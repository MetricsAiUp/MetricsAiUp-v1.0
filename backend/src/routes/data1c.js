/**
 * data1c.js — API routes for 1C synchronization
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { importSchema } = require('../schemas/data1c');
const sync1C = require('../services/sync1C');

const DATA_DIR = path.join(__dirname, '../../../data');

// Helper: read JSON file from data directory
function readDataFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

// POST /api/1c/import — Upload xlsx file (base64 in JSON body)
router.post('/import', async (req, res) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.issues,
      });
    }

    const { filename, data } = parsed.data;
    const buffer = Buffer.from(data, 'base64');

    const result = await sync1C.importFromXlsx(buffer, filename, 'api');

    res.json({
      success: true,
      ...result,
    });
  } catch (e) {
    console.error('[data1c] Import error:', e);
    res.status(500).json({ error: 'Import failed', message: e.message });
  }
});

// POST /api/1c/export — Generate and return xlsx download
router.post('/export', async (req, res) => {
  try {
    const filters = req.body || {};
    const buffer = await sync1C.exportToXlsx(filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="work-orders-export.xlsx"`);
    res.send(buffer);
  } catch (e) {
    console.error('[data1c] Export error:', e);
    res.status(500).json({ error: 'Export failed', message: e.message });
  }
});

// GET /api/1c/sync-history — Get sync log history
router.get('/sync-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await sync1C.getSyncHistory(limit);
    res.json(history);
  } catch (e) {
    console.error('[data1c] Sync history error:', e);
    res.status(500).json({ error: 'Failed to get sync history', message: e.message });
  }
});

// GET /api/1c/planning — Get planning data from JSON
router.get('/planning', (req, res) => {
  const data = readDataFile('1c-planning.json');
  res.json(data || []);
});

// GET /api/1c/workers — Get workers data from JSON
router.get('/workers', (req, res) => {
  const data = readDataFile('1c-workers.json');
  res.json(data || []);
});

// GET /api/1c/stats — Get stats from JSON
router.get('/stats', (req, res) => {
  const data = readDataFile('1c-stats.json');
  res.json(data || {});
});

module.exports = router;
