// Выработка — агрегация по ролям (executor / master / dispatcher).
//
// Источник нормочасов/заказов: deduped performed (последний снимок per orderNumber).
// CV-часы: тот же алгоритм, что в /api/oneC/matching/closed-cv —
//   эпизоды занятости постов в окне [workStartedAt − 12h, workFinishedAt + 12h],
//   plate-каскад (exact/core/lev1/lev2/last4), probability ≥ CV_WEAK → засчитываем.
// В каждом ролевом срезе CV-время каждой ЗН целиком засчитывается роли (опция 2a).
//
// Permission: view_1c.

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { authenticate, requirePermission } = require('../middleware/auth');
const deduped = require('../services/oneCDeduped');
const cvEpisodes = require('../services/cvEpisodes');

const ROLE_COLUMNS = { executor: 'executor', master: 'master', dispatcher: 'dispatcher' };

// Эти константы синхронизированы с /matching/closed-cv:
const CV_WINDOW_HOURS = 12;
const CV_MIN_PLATE_SCORE = 0.30;
const CV_WEAK = 0.30;

router.get('/', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const role = String(req.query.role || 'executor');
    const col = ROLE_COLUMNS[role];
    if (!col) return res.status(400).json({ error: `unknown role: ${role}` });

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    // 1. Последний performed по orderNumber.
    const performedAll = await deduped.getDedupedPerformedRows();
    const latestByOrder = new Map();
    for (const p of performedAll) {
      if (!p.orderNumber) continue;
      const cur = latestByOrder.get(p.orderNumber);
      const t = p.receivedAt ? new Date(p.receivedAt).getTime() : 0;
      const tc = cur && cur.receivedAt ? new Date(cur.receivedAt).getTime() : -1;
      if (!cur || t > tc) latestByOrder.set(p.orderNumber, p);
    }
    const latest = [...latestByOrder.values()];

    // 2. Фильтр по периоду закрытия.
    const filtered = latest.filter((p) => {
      const closed = p.closedAt ? new Date(p.closedAt) : null;
      if (from && (!closed || closed < from)) return false;
      if (to && (!closed || closed > to)) return false;
      return true;
    });

    // 3. Общее CV-окно для построения эпизодов: [min(ws)−12h, max(we)+12h].
    let minStart = null, maxEnd = null;
    for (const p of filtered) {
      const ws = p.workStartedAt ? new Date(p.workStartedAt).getTime() : null;
      const we = p.workFinishedAt ? new Date(p.workFinishedAt).getTime() : null;
      if (Number.isFinite(ws) && (minStart == null || ws < minStart)) minStart = ws;
      if (Number.isFinite(we) && (maxEnd == null || we > maxEnd)) maxEnd = we;
    }
    const windowMs = CV_WINDOW_HOURS * 60 * 60 * 1000;
    const fromTs = minStart != null ? new Date(minStart - windowMs) : null;
    const toTs = maxEnd != null ? new Date(maxEnd + windowMs) : null;

    const allEpisodes = (fromTs && toTs)
      ? await cvEpisodes.buildEpisodesInWindow(fromTs, toTs)
      : [];
    allEpisodes.sort((a, b) => (new Date(a.startTime).getTime()) - (new Date(b.startTime).getTime()));
    const epStarts = allEpisodes.map((e) => e.startTime ? new Date(e.startTime).getTime() : 0);

    function lowerBound(value) {
      let lo = 0, hi = epStarts.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (epStarts[mid] < value) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    // 4. Для каждой ЗН — собрать CV-секунды (тот же алгоритм что в closed-cv).
    const cvSecByOrder = new Map();
    for (const p of filtered) {
      const refPlate = p.plateNumber || null;
      const ws = p.workStartedAt ? new Date(p.workStartedAt) : null;
      const we = p.workFinishedAt ? new Date(p.workFinishedAt) : null;
      const wFrom = ws ? new Date(ws.getTime() - windowMs) : (we ? new Date(we.getTime() - windowMs) : null);
      const wTo = we ? new Date(we.getTime() + windowMs) : (ws ? new Date(ws.getTime() + windowMs) : null);
      if (!refPlate || !wFrom || !wTo) continue;

      const lo = lowerBound(wFrom.getTime() - 24 * 60 * 60 * 1000);
      const hiTs = wTo.getTime();
      let totalSec = 0;
      for (let i = lo; i < allEpisodes.length; i++) {
        if (epStarts[i] > hiTs) break;
        const ep = allEpisodes[i];
        const epEndTs = ep.endTime ? new Date(ep.endTime).getTime() : epStarts[i];
        if (epEndTs < wFrom.getTime()) continue;

        const { plateScore } = cvEpisodes.scoreEpisodeAgainstRef(ep, refPlate);
        if (plateScore < CV_MIN_PLATE_SCORE) continue;

        const timeOverlap = cvEpisodes.computeTimeOverlap(ws, we, ep.startTime, ep.endTime);
        const probability = plateScore * (0.5 + 0.5 * (ep.plateConsensusRatio || 0)) * (0.4 + 0.6 * timeOverlap);
        if (probability < CV_WEAK) continue;

        totalSec += ep.durationSec || 0;
      }
      if (totalSec > 0) cvSecByOrder.set(p.orderNumber, totalSec);
    }

    // 5. Группировка по роли.
    const byPerson = new Map();
    for (const p of filtered) {
      const name = (p[col] || '').trim() || '— не указан —';
      if (!byPerson.has(name)) {
        byPerson.set(name, { person: name, normHours: 0, orders: 0, cvSeconds: 0, repairs: new Map() });
      }
      const acc = byPerson.get(name);
      acc.normHours += Number(p.normHours) || 0;
      acc.orders += 1;
      acc.cvSeconds += cvSecByOrder.get(p.orderNumber) || 0;
      const rk = p.repairKind || '—';
      acc.repairs.set(rk, (acc.repairs.get(rk) || 0) + 1);
    }

    const items = [...byPerson.values()]
      .map((x) => ({
        person: x.person,
        normHours: Math.round(x.normHours * 10) / 10,
        orders: x.orders,
        cvHours: Math.round((x.cvSeconds / 3600) * 10) / 10,
        repairKinds: [...x.repairs.entries()].map(([k, v]) => ({ kind: k, count: v })),
      }))
      .sort((a, b) => b.normHours - a.normHours);

    const totalNorm = items.reduce((s, x) => s + x.normHours, 0);
    const totalCv = items.reduce((s, x) => s + x.cvHours, 0);

    res.json({
      role,
      items,
      totalNorm: Math.round(totalNorm * 10) / 10,
      totalCvHours: Math.round(totalCv * 10) / 10,
      from,
      to,
    });
  } catch (err) {
    logger.error('GET /payroll failed', { err: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
