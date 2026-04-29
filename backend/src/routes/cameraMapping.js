/**
 * cameraMapping.js — Stores zone→camera UI mapping as a JSON blob.
 * Replaces localStorage('cameraMappingData') in CameraMapping.jsx.
 * Mapping shape: { [zoneId]: { [camId]: priority(number) } }
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate, requirePermission } = require('../middleware/auth');
const logger = require('../config/logger');

const MAPPING_FILE = path.join(__dirname, '../../../data/camera-mapping.json');

function readMapping() {
  try {
    if (fs.existsSync(MAPPING_FILE)) {
      return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
    }
  } catch (e) {
    logger.error('Read camera-mapping failed', { error: e.message });
  }
  return null;
}

function writeMapping(data) {
  const dir = path.dirname(MAPPING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(data, null, 2));
}

// GET /api/camera-mapping — read stored mapping (returns null if not yet saved)
router.get('/', authenticate, (req, res) => {
  res.json(readMapping());
});

// POST /api/camera-mapping — replace stored mapping
router.post('/', authenticate, requirePermission('manage_cameras'), (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be an object' });
  }
  try {
    writeMapping(req.body);
    res.json({ success: true });
  } catch (e) {
    logger.error('Save camera-mapping failed', { error: e.message });
    res.status(500).json({ error: 'Save failed', message: e.message });
  }
});

// DELETE /api/camera-mapping — reset to default (delete stored)
router.delete('/', authenticate, requirePermission('manage_cameras'), (req, res) => {
  try {
    if (fs.existsSync(MAPPING_FILE)) fs.unlinkSync(MAPPING_FILE);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reset camera-mapping failed', { error: e.message });
    res.status(500).json({ error: 'Reset failed', message: e.message });
  }
});

module.exports = router;
