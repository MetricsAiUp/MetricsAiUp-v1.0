/**
 * Backup admin endpoints.
 * GET  /api/backup       — list available backups
 * POST /api/backup       — create backup on demand (admin)
 */

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const backupScheduler = require('../services/backupScheduler');

const router = express.Router();

router.get(
  '/',
  authenticate,
  requirePermission('manage_settings'),
  asyncHandler(async (_req, res) => {
    res.json(backupScheduler.listBackups());
  })
);

router.post(
  '/',
  authenticate,
  requirePermission('manage_settings'),
  asyncHandler(async (_req, res) => {
    const result = await backupScheduler.createBackup('manual');
    if (!result.success) return res.status(500).json(result);
    res.json(result);
  })
);

module.exports = router;
