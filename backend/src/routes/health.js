const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const START_TIME = Date.now();

router.get('/', authenticate, async (req, res) => {
  const result = {};
  // Backend
  result.backend = { status: 'ok', uptime: Math.floor((Date.now() - START_TIME) / 1000), version: '1.0.0', nodeVersion: process.version, memoryUsage: process.memoryUsage() };
  // Database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const pingMs = Date.now() - start;
    const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(dbPath).size; } catch {}
    result.database = { status: 'ok', pingMs, sizeBytes, sizeMB: +(sizeBytes / 1024 / 1024).toFixed(2) };
  } catch (err) { result.database = { status: 'error', error: err.message }; }
  // Cameras
  try {
    const { getCameraStatuses } = require('../services/cameraHealthCheck');
    const statuses = getCameraStatuses();
    result.cameras = Object.entries(statuses).map(([id, s]) => ({ id, online: s.online, lastCheck: s.lastCheck }));
  } catch { result.cameras = { status: 'unavailable' }; }
  // 1C Sync
  try {
    const lastSync = await prisma.syncLog.findFirst({ orderBy: { createdAt: 'desc' } });
    result.sync1c = lastSync ? { lastSyncAt: lastSync.createdAt, status: lastSync.status, records: lastSync.records, errors: lastSync.errors } : { status: 'never' };
  } catch { result.sync1c = { status: 'unknown' }; }
  // Disk
  try {
    const dfOutput = execSync('df -B1 / | tail -1').toString().trim();
    const parts = dfOutput.split(/\s+/);
    result.disk = { totalBytes: parseInt(parts[1]), usedBytes: parseInt(parts[2]), availableBytes: parseInt(parts[3]), usagePercent: parseInt(parts[4]) };
  } catch { result.disk = { status: 'unknown' }; }
  res.json(result);
});

module.exports = router;
