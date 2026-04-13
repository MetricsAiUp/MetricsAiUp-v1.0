const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../data/app-settings.json');

const DEFAULT_SETTINGS = {
  mode: 'demo', // 'demo' | 'live'
};

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(data) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/settings — get current app settings
router.get('/', authenticate, asyncHandler(async (req, res) => {
  res.json(readSettings());
}));

// PUT /api/settings — update app settings (admin only)
router.put('/', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const current = readSettings();
  const { mode } = req.body;

  if (mode && ['demo', 'live'].includes(mode)) {
    current.mode = mode;
  }

  writeSettings(current);

  // Notify all clients about mode change
  const io = req.app.get('io');
  if (io) io.emit('settings:changed', current);

  // Start/stop demo generator
  const demoControl = req.app.get('demoControl');
  if (demoControl) {
    if (current.mode === 'demo') demoControl.start();
    else demoControl.stop();
  }

  res.json(current);
}));

// Export readSettings for use in index.js
router.readSettings = readSettings;

module.exports = router;
