const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { computeUtilization } = require('../services/utilizationReport');

// ─── helpers ──────────────────────────────────────────────────────────────

function parsePeriod(query) {
  const fromStr = query.from;
  const toStr = query.to;
  if (!fromStr || !toStr) {
    const err = new Error('Параметры from и to обязательны (ISO-строки)');
    err.status = 400;
    throw err;
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    const err = new Error('Некорректный период');
    err.status = 400;
    throw err;
  }
  return { from, to };
}

// ─── GET /api/reports/utilization ─────────────────────────────────────────
//
//   ?from=ISO &to=ISO  &entity=posts|zones  &compare=true|false  &locationId=
//
router.get('/utilization', authenticate, requirePermission('view_analytics'), asyncHandler(async (req, res) => {
  const { from, to } = parsePeriod(req.query);
  const entity = req.query.entity === 'zones' ? 'zones' : 'posts';
  const compare = req.query.compare === 'true' || req.query.compare === '1';
  const locationId = req.query.locationId || null;

  const result = await computeUtilization({ from, to, entity, locationId, compare });
  res.json(result);
}));

// ─── PUT /api/reports/utilization/settings ────────────────────────────────
//
//   body: { workStart?, workEnd?, workDays?, hourlyRate?, currency?,
//           errorMarginPct?, errorMarginNote?, locationId? }
//
router.put('/utilization/settings', authenticate, requirePermission('manage_settings'), asyncHandler(async (req, res) => {
  const {
    workStart, workEnd, workDays, hourlyRate, currency,
    errorMarginPct, errorMarginNote, locationId,
  } = req.body;

  // Валидация HH:mm
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (workStart != null && !TIME_RE.test(workStart)) {
    return res.status(400).json({ error: 'workStart должен быть в формате HH:mm' });
  }
  if (workEnd != null && !TIME_RE.test(workEnd)) {
    return res.status(400).json({ error: 'workEnd должен быть в формате HH:mm' });
  }
  if (workDays != null) {
    const parsed = String(workDays).split(',').map(s => Number(s.trim()));
    if (parsed.some(n => !Number.isInteger(n) || n < 1 || n > 7)) {
      return res.status(400).json({ error: 'workDays — список ISO-дней через запятую (1..7)' });
    }
  }
  if (hourlyRate != null && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
    return res.status(400).json({ error: 'hourlyRate должен быть числом ≥ 0' });
  }
  if (errorMarginPct != null && (typeof errorMarginPct !== 'number' || errorMarginPct < 0 || errorMarginPct > 100)) {
    return res.status(400).json({ error: 'errorMarginPct в диапазоне 0..100' });
  }

  // Берём активную локацию или создаём дефолтную, если её нет
  let location = locationId
    ? await prisma.location.findUnique({ where: { id: locationId } })
    : await prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });

  if (!location) {
    location = await prisma.location.create({
      data: { name: 'СТО', timezone: 'Europe/Moscow' },
    });
  }

  const data = {};
  if (workStart !== undefined) data.workStart = workStart;
  if (workEnd !== undefined) data.workEnd = workEnd;
  if (workDays !== undefined) data.workDays = String(workDays);
  if (hourlyRate !== undefined) data.hourlyRate = hourlyRate;
  if (currency !== undefined) data.currency = currency;
  if (errorMarginPct !== undefined) data.errorMarginPct = errorMarginPct;
  if (errorMarginNote !== undefined) data.errorMarginNote = errorMarginNote;

  const updated = await prisma.location.update({ where: { id: location.id }, data });
  res.json({
    ok: true,
    location: {
      id: updated.id,
      name: updated.name,
      timezone: updated.timezone,
      workStart: updated.workStart,
      workEnd: updated.workEnd,
      workDays: updated.workDays,
      hourlyRate: updated.hourlyRate != null ? Number(updated.hourlyRate) : null,
      currency: updated.currency,
      errorMarginPct: updated.errorMarginPct,
      errorMarginNote: updated.errorMarginNote,
    },
  });
}));

// ─── GET /api/reports/utilization/settings ────────────────────────────────
// Возвращает текущие настройки для UI (шапка отчёта).
router.get('/utilization/settings', authenticate, requirePermission('view_analytics'), asyncHandler(async (req, res) => {
  const location = await prisma.location.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!location) {
    return res.json({
      workStart: '08:00', workEnd: '20:00', workDays: '1,2,3,4,5,6',
      hourlyRate: null, currency: 'RUB',
      errorMarginPct: null, errorMarginNote: null,
      timezone: 'Europe/Moscow',
    });
  }
  res.json({
    locationId: location.id,
    name: location.name,
    timezone: location.timezone,
    workStart: location.workStart,
    workEnd: location.workEnd,
    workDays: location.workDays,
    hourlyRate: location.hourlyRate != null ? Number(location.hourlyRate) : null,
    currency: location.currency,
    errorMarginPct: location.errorMarginPct,
    errorMarginNote: location.errorMarginNote,
  });
}));

module.exports = router;
