const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../data/app-settings.json');

const DEFAULT_SETTINGS = {
  mode: 'demo', // 'demo' | 'live'
  timezone: 'Europe/Moscow', // IANA TZ для интерпретации shiftStart/shiftEnd и дневных границ
};

// Проверка, что строка — валидная IANA-таймзона (поддерживается рантаймом).
function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

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
  const { mode, weekSchedule, postsCount, shiftStart, shiftEnd, timezone } = req.body;

  if (mode && ['demo', 'live'].includes(mode)) {
    current.mode = mode;
  }
  if (weekSchedule !== undefined) current.weekSchedule = weekSchedule;
  if (postsCount !== undefined) current.postsCount = postsCount;
  if (shiftStart !== undefined) current.shiftStart = shiftStart;
  if (shiftEnd !== undefined) current.shiftEnd = shiftEnd;
  if (timezone !== undefined) {
    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ error: `Invalid timezone: ${timezone}` });
    }
    current.timezone = timezone;
  }

  writeSettings(current);

  // Notify all clients about mode change
  const io = req.app.get('io');
  if (io) io.emit('settings:changed', current);

  // Start/stop demo generator and monitoring proxy.
  // Wait for the previous mode's writers to drain before starting the new one
  // so demo and live can't both write to the DB at the same time.
  const demoControl = req.app.get('demoControl');
  const monitoringControl = req.app.get('monitoringControl');
  if (current.mode === 'demo') {
    if (monitoringControl) await monitoringControl.stop();
    if (demoControl) await demoControl.start();
  } else {
    if (demoControl) await demoControl.stop();
    if (monitoringControl) await monitoringControl.start();
  }

  res.json(current);
}));

// Export readSettings for use in index.js
router.readSettings = readSettings;

module.exports = router;
