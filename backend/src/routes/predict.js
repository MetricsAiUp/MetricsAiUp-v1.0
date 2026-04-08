const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../../data');

// ─── Deterministic seeded random for consistent predictions within the hour ───
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Load pattern: realistic STO daily load curve ───
function baseLoad(hour, dow) {
  // Weekend — lower load
  const weekendFactor = dow >= 5 ? 0.4 : 1.0;
  // Daily curve: ramp up 8-10, peak 10-12, dip 13, afternoon peak 14-16, wind down 17-20
  const curve = {
    8: 0.35, 9: 0.55, 10: 0.78, 11: 0.85, 12: 0.75,
    13: 0.55, 14: 0.72, 15: 0.80, 16: 0.70, 17: 0.55,
    18: 0.40, 19: 0.25, 20: 0.10,
  };
  return (curve[hour] || 0.3) * weekendFactor;
}

// ─── GET /predict/load ───
router.get('/load', (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  const postFilter = req.query.post ? parseInt(req.query.post) : null;
  const date = new Date(dateStr);
  const dow = date.getDay();
  const dateSeed = Math.floor(date.getTime() / 86400000);

  const posts = postFilter ? [postFilter] : Array.from({ length: 10 }, (_, i) => i + 1);
  const hourly = [];

  for (let h = 8; h <= 20; h++) {
    const rand = seededRand(dateSeed * 100 + h);
    const predictions = {};
    for (const p of posts) {
      const noise = (rand() - 0.5) * 0.2;
      const postVariation = (rand() - 0.5) * 0.15;
      const load = Math.max(0, Math.min(1, baseLoad(h, dow) + noise + postVariation));
      predictions[`post_${p}`] = Math.round(load * 1000) / 1000;
    }
    const values = Object.values(predictions);
    const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000;
    hourly.push({ hour: h, predictions, avg });
  }

  res.json({ date: dateStr, post: postFilter, hourly });
});

// ─── GET /predict/load/week ───
router.get('/load/week', (req, res) => {
  const postFilter = req.query.post ? parseInt(req.query.post) : null;
  const now = new Date();
  const days = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const dow = date.getDay();
    const dateSeed = Math.floor(date.getTime() / 86400000);
    const posts = postFilter ? [postFilter] : Array.from({ length: 10 }, (_, i) => i + 1);
    const hourly = [];

    for (let h = 8; h <= 20; h++) {
      const rand = seededRand(dateSeed * 100 + h);
      const predictions = {};
      for (const p of posts) {
        const load = Math.max(0, Math.min(1, baseLoad(h, dow) + (rand() - 0.5) * 0.2));
        predictions[`post_${p}`] = Math.round(load * 1000) / 1000;
      }
      const values = Object.values(predictions);
      const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000;
      hourly.push({ hour: h, predictions, avg });
    }

    const avgLoad = Math.round((hourly.reduce((s, h) => s + h.avg, 0) / hourly.length) * 1000) / 1000;
    const peakHour = hourly.reduce((max, h) => h.avg > max.avg ? h : max, hourly[0]);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    days.push({
      date: dateStr,
      weekday: weekdays[dow],
      avg_load: avgLoad,
      peak_hour: peakHour.hour,
      hourly,
    });
  }

  res.json({ post: postFilter, days });
});

// ─── GET /predict/duration ───
router.get('/duration', (req, res) => {
  const workType = req.query.work_type || 'diagnostics';
  const brand = req.query.brand || null;

  const baselines = {
    diagnostics: 1.0, oil_change: 0.8, brake_service: 2.5,
    tire_mounting: 1.2, alignment: 1.5, engine_repair: 4.0,
    body_work: 6.0, electrical: 2.0, suspension: 3.0, ac_service: 1.5,
  };
  const base = baselines[workType] || 2.0;
  const brandFactors = {
    'CITROEN': 1.1, 'OPEL': 1.05, 'PEUGEOT': 1.1, 'BMW': 1.2,
    'DONGFENG': 1.15, 'MAXUS': 1.1, 'HYUNDAI': 0.9, 'RENAULT': 0.95,
  };
  const factor = brand ? (brandFactors[brand.toUpperCase()] || 1.0) : 1.0;
  const predicted = Math.round(base * factor * 100) / 100;

  res.json({
    work_type: workType, brand,
    predicted_hours: predicted,
    confidence: 0.78,
    range_min: Math.round(predicted * 0.7 * 100) / 100,
    range_max: Math.round(predicted * 1.4 * 100) / 100,
  });
});

// ─── GET /predict/free ───
router.get('/free', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'dashboard-posts.json'), 'utf-8');
    const data = JSON.parse(raw);
    const posts = data.posts || [];
    const now = new Date();

    const predictions = posts.map(p => {
      if (p.status === 'free') {
        return { post: p.number, status: 'free', free_in_minutes: 0 };
      }
      const wo = (p.timeline || []).find(t => t.status === 'in_progress');
      if (wo && wo.estimatedEnd) {
        const end = new Date(wo.estimatedEnd);
        const remaining = Math.max(0, Math.round((end - now) / 60000));
        return { post: p.number, status: 'occupied', free_in_minutes: remaining, estimated_free: wo.estimatedEnd };
      }
      return { post: p.number, status: 'occupied', free_in_minutes: null };
    });

    res.json({ predictions });
  } catch {
    res.json({ predictions: [] });
  }
});

// ─── GET /health ───
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ml-predict-builtin' });
});

module.exports = router;
