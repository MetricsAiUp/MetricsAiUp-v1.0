/**
 * Replay (история) — слайдер времени для MapViewer.
 *
 * Источник данных — таблица monitoring_snapshots (живой режим, monitoringProxy
 * пишет дельты при изменении значимых полей). В демо-режиме записей нет.
 *
 * Эндпоинты:
 *   GET /api/replay/range
 *     -> { earliest, latest, totalSnapshots, zoneNames }
 *
 *   GET /api/replay/window?from=<ISO>&to=<ISO>
 *     -> {
 *          from, to,
 *          zones: [zoneName, ...],
 *          initial: [snap-per-zone-at-or-before-from],
 *          events:  [snap rows in (from, to], asc by timestamp]
 *        }
 *     Каждая запись имеет ту же форму, что rawState на фронте:
 *       { zone, timestamp, status, worksInProgress, worksDescription,
 *         peopleCount, confidence, openParts: [], car: { plate, color, model, make, body } }
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const prisma = require('../config/database');

// Жёсткий потолок окна — чтобы не утянуть всю БД одним запросом.
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней
const MAX_EVENTS = 50_000;

function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeJsonArray(s) {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// monitoring_snapshots row -> rawState-совместимый объект
function snapshotToRaw(s) {
  return {
    zone: s.zoneName,
    externalType: s.externalType,
    timestamp: s.timestamp.toISOString(),
    status: s.status,
    worksInProgress: !!s.worksInProgress,
    worksDescription: s.worksDescription,
    peopleCount: s.peopleCount || 0,
    openParts: safeJsonArray(s.openParts),
    confidence: s.confidence,
    car: {
      plate: s.plateNumber,
      color: s.carColor,
      model: s.carModel,
      make: s.carMake,
      body: s.carBody,
      firstSeen: s.carFirstSeen ? s.carFirstSeen.toISOString() : null,
    },
  };
}

// GET /api/replay/range — глобальные границы доступной истории.
router.get('/range', authenticate, asyncHandler(async (_req, res) => {
  const [earliest, latest, total, zones] = await Promise.all([
    prisma.monitoringSnapshot.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    }),
    prisma.monitoringSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
    prisma.monitoringSnapshot.count(),
    prisma.monitoringSnapshot.findMany({
      distinct: ['zoneName'],
      select: { zoneName: true },
    }),
  ]);
  res.json({
    earliest: earliest?.timestamp?.toISOString() || null,
    latest: latest?.timestamp?.toISOString() || null,
    totalSnapshots: total,
    zoneNames: zones.map(z => z.zoneName).sort((a, b) => a.localeCompare(b, 'ru')),
  });
}));

// GET /api/replay/window?from=<ISO>&to=<ISO>
router.get('/window', authenticate, asyncHandler(async (req, res) => {
  const from = parseIso(req.query.from);
  const to = parseIso(req.query.to);
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to (ISO timestamps) required' });
  }
  if (to <= from) {
    return res.status(400).json({ error: 'to must be greater than from' });
  }
  if (to - from > MAX_WINDOW_MS) {
    return res.status(400).json({
      error: `window too large (max ${MAX_WINDOW_MS / 3600000}h)`,
    });
  }

  // Все распознанные имена зон, чтобы фронт мог отрендерить и зоны без событий в окне.
  const zoneRows = await prisma.monitoringSnapshot.findMany({
    distinct: ['zoneName'],
    select: { zoneName: true },
  });
  const zoneNames = zoneRows.map(z => z.zoneName);

  // Initial state — последний снапшот ≤ from для каждой зоны.
  // Дешевле всего: для каждой зоны взять top-1 desc.
  const initial = [];
  for (const zoneName of zoneNames) {
    const row = await prisma.monitoringSnapshot.findFirst({
      where: { zoneName, timestamp: { lte: from } },
      orderBy: { timestamp: 'desc' },
    });
    if (row) initial.push(snapshotToRaw(row));
  }

  // События в окне (from, to] по возрастанию.
  const events = await prisma.monitoringSnapshot.findMany({
    where: { timestamp: { gt: from, lte: to } },
    orderBy: { timestamp: 'asc' },
    take: MAX_EVENTS,
  });

  res.json({
    from: from.toISOString(),
    to: to.toISOString(),
    zones: zoneNames.sort((a, b) => a.localeCompare(b, 'ru')),
    initial,
    events: events.map(snapshotToRaw),
    truncated: events.length === MAX_EVENTS,
  });
}));

module.exports = router;
