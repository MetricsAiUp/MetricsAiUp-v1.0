// Эндпоинт сопоставления «Заказ-наряды ↔ Заявки/Планы».
//
// Алгоритм:
//   1. Берём дедуплицированные ЗН (oneCDeduped.getDedupedRepairRows).
//   2. Берём дедуплицированные plan-строки (oneCDeduped.getDedupedPlanRows).
//   3. Группируем plan по documentText (охватывающий интервал = min start … max end).
//   4. Для каждого ЗН: match = planByDoc.get(repair.basis).
//        no_basis | basis_not_found | matched_vehicle_mismatch | matched
//   5. Считаем для строки:
//        dates: planStart/planEnd, uchnStart/uchnEnd (=basisStart/End ЗН),
//               factStart/factEnd (=workStartedAt/workFinishedAt), + severities моментов.
//        durations: tPlan, tUchn, tFact, deltaPlan = tFact-tPlan, deltaUchn = tFact-tUchn.
//   6. Группируем версии одного ЗН по orderNumber → latest для главной, history[] для detail.
//   7. Фильтры, сортировка, пагинация, KPI.

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { authenticate, requirePermission } = require('../middleware/auth');
const deduped = require('../services/oneCDeduped');

// Пороги подсветки (sec): ≤15м green, ≤1ч yellow, ≤4ч orange, >4ч red
const DELTA_THRESHOLDS = { green: 15 * 60, yellow: 60 * 60, orange: 4 * 60 * 60 };
const SEVERITY_RANK = { gray: 0, green: 1, yellow: 2, orange: 3, red: 4 };

function severityFromDelta(deltaSec) {
  if (deltaSec == null) return 'gray';
  const a = Math.abs(deltaSec);
  if (a <= DELTA_THRESHOLDS.green) return 'green';
  if (a <= DELTA_THRESHOLDS.yellow) return 'yellow';
  if (a <= DELTA_THRESHOLDS.orange) return 'orange';
  return 'red';
}
function maxSeverity(...sevs) {
  let best = 'gray';
  for (const s of sevs) if (SEVERITY_RANK[s] > SEVERITY_RANK[best]) best = s;
  return best;
}
function diffSec(a, b) {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((da - db) / 1000);
}
function durationSec(start, end) {
  return diffSec(end, start);
}

// Нормализация авто для sanity-check.
function normPlate(p) { return p ? String(p).toUpperCase().replace(/[\s\-]/g, '') : ''; }
function normVin(v) { return v ? String(v).toUpperCase().replace(/\s/g, '') : ''; }

function vehicleMatches(repair, planRows) {
  const rVin = normVin(repair.vin);
  const rPlates = [normPlate(repair.plateNumber1), normPlate(repair.plateNumber2)].filter(Boolean);
  for (const p of planRows) {
    const pVin = normVin(p.vin);
    const pPlate = normPlate(p.plateNumber);
    if (rVin && pVin && rVin !== pVin) return false;
    if (rPlates.length && pPlate && !rPlates.includes(pPlate)) return false;
  }
  return true;
}

function extractPlanNumberFromBasis(basis) {
  if (!basis) return null;
  const m = String(basis).match(/№\s*([\w-]+)/u);
  return m ? m[1] : null;
}

// Охватывающий интервал плана (min start, max end) по всем plan-rows одного documentText
function planSpan(planRows) {
  let s = null, e = null;
  for (const p of planRows) {
    const ps = p.scheduledStart ? new Date(p.scheduledStart).getTime() : null;
    const pe = p.scheduledEnd ? new Date(p.scheduledEnd).getTime() : null;
    if (ps != null && (s == null || ps < s)) s = ps;
    if (pe != null && (e == null || pe > e)) e = pe;
  }
  return {
    planStart: s != null ? new Date(s).toISOString() : null,
    planEnd:   e != null ? new Date(e).toISOString() : null,
  };
}

// Подсветка моментов дат в столбцах «Начало» и «Окончание»:
//   план — эталон (gray)
//   уточн — severity по |uchn - plan|
//   факт  — severity по |fact - uchn| (если uchn есть), иначе |fact - plan|
function momentSeverities(planStart, planEnd, uchnStart, uchnEnd, factStart, factEnd) {
  const uchnStartSev = severityFromDelta(diffSec(uchnStart, planStart));
  const uchnEndSev   = severityFromDelta(diffSec(uchnEnd,   planEnd));
  const factStartRef = uchnStart || planStart;
  const factEndRef   = uchnEnd   || planEnd;
  const factStartSev = severityFromDelta(diffSec(factStart, factStartRef));
  const factEndSev   = severityFromDelta(diffSec(factEnd,   factEndRef));
  return { uchnStartSev, uchnEndSev, factStartSev, factEndSev };
}

// «Сырая» репрезентация ЗН для detail-панели (12 колонок «Заказ-наряды» + receivedAt для лога).
function repairForDetail(r, isLatest) {
  return {
    id: r.id,
    isLatest,
    receivedAt: r.receivedAt,
    vehicleText: r.vehicleText,
    brand: r.brand,
    model: r.model,
    plateNumber1: r.plateNumber1,
    plateNumber2: r.plateNumber2,
    vin: r.vin,
    orderNumber: r.orderNumber,
    state: r.state,
    repairKind: r.repairKind,
    workStartedAt: r.workStartedAt,
    workFinishedAt: r.workFinishedAt,
    closedAt: r.closedAt,
    basis: r.basis,
    basisStart: r.basisStart,
    basisEnd: r.basisEnd,
    master: r.master,
    dispatcher: r.dispatcher,
  };
}

// GET /api/oneC/matching
router.get('/matching', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const [repairs, plans] = await Promise.all([
      deduped.getDedupedRepairRows(),
      deduped.getDedupedPlanRows(),
    ]);

    // plan rows by documentText
    const planByDoc = new Map();
    for (const p of plans) {
      const key = p.documentText || '';
      if (!key) continue;
      if (!planByDoc.has(key)) planByDoc.set(key, []);
      planByDoc.get(key).push(p);
    }

    // Группируем версии одного ЗН по orderNumber.
    // На главной — самая свежая по receivedAt; история = все версии (свежее сверху).
    const versionsByOrder = new Map();
    for (const r of repairs) {
      const key = r.orderNumber || `__noorder_${r.id}`;
      if (!versionsByOrder.has(key)) versionsByOrder.set(key, []);
      versionsByOrder.get(key).push(r);
    }
    for (const arr of versionsByOrder.values()) {
      arr.sort((a, b) => {
        const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return tb - ta;
      });
    }
    const latestRepairs = Array.from(versionsByOrder.values()).map((arr) => arr[0]);

    const all = latestRepairs.map((r) => {
      const versions = versionsByOrder.get(r.orderNumber || `__noorder_${r.id}`) || [r];
      const basis = r.basis || null;
      const planRows = basis ? (planByDoc.get(basis) || []) : [];

      let matchStatus, planNumber = null;
      if (!basis) matchStatus = 'no_basis';
      else if (planRows.length === 0) {
        matchStatus = 'basis_not_found';
        planNumber = extractPlanNumberFromBasis(basis);
      } else {
        matchStatus = vehicleMatches(r, planRows) ? 'matched' : 'matched_vehicle_mismatch';
        planNumber = planRows[0].number || extractPlanNumberFromBasis(basis);
      }

      // Даты для столбцов «Начало»/«Окончание»
      const { planStart, planEnd } = planSpan(planRows);
      const uchnStart = r.basisStart || null;
      const uchnEnd   = r.basisEnd   || null;
      const factStart = r.workStartedAt  || null;
      const factEnd   = r.workFinishedAt || null;

      const momSev = momentSeverities(planStart, planEnd, uchnStart, uchnEnd, factStart, factEnd);

      // Длительности и Δ
      const tPlan = durationSec(planStart, planEnd);
      const tUchn = durationSec(uchnStart, uchnEnd);
      const tFact = durationSec(factStart, factEnd);
      const deltaPlan = (tFact != null && tPlan != null) ? (tFact - tPlan) : null;
      const deltaUchn = (tFact != null && tUchn != null) ? (tFact - tUchn) : null;
      const sevPlan = severityFromDelta(deltaPlan);
      const sevUchn = severityFromDelta(deltaUchn);

      // История версий этого ЗН (latest сверху). Detail-панель = лог изменений.
      const hasHistory = versions.length > 1;
      const history = hasHistory
        ? versions.map((v, idx) => repairForDetail(v, idx === 0))
        : null;

      // overall severity по моментам И по длительностям — для KPI и сортировки
      const severity = maxSeverity(
        momSev.uchnStartSev, momSev.uchnEndSev, momSev.factStartSev, momSev.factEndSev,
        sevPlan, sevUchn,
      );

      return {
        // ЗН
        id: r.id,
        orderNumber: r.orderNumber,
        state: r.state,
        repairKind: r.repairKind,
        vehicleText: r.vehicleText,
        brand: r.brand,
        model: r.model,
        plateNumber1: r.plateNumber1,
        plateNumber2: r.plateNumber2,
        vin: r.vin,
        master: r.master,
        dispatcher: r.dispatcher,
        basis,

        // матч
        matchStatus,
        planNumber,

        // даты для столбцов
        dates: {
          planStart, planEnd,
          uchnStart, uchnEnd,
          factStart, factEnd,
          sev: momSev,
        },
        // длительности и дельты
        durations: {
          tPlan, tUchn, tFact,
          deltaPlan, deltaUchn,
          sevPlan, sevUchn,
        },

        severity,
        hasHistory,
        history,
      };
    });

    // Фильтры
    const q = req.query.q ? String(req.query.q).toLowerCase() : null;
    const states = req.query.state ? String(req.query.state).split(',').filter(Boolean) : null;
    const matchStatuses = req.query.matchStatus ? String(req.query.matchStatus).split(',').filter(Boolean) : null;
    const minSeverity = req.query.minSeverity ? String(req.query.minSeverity) : null;
    const master = req.query.master ? String(req.query.master).toLowerCase() : null;
    const dispatcher = req.query.dispatcher ? String(req.query.dispatcher).toLowerCase() : null;
    const repairKind = req.query.repairKind ? String(req.query.repairKind).toLowerCase() : null;
    const dateField = req.query.dateField === 'basisStart' ? 'basisStart' : 'workStartedAt';
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    function pass(item) {
      if (states && !states.includes(item.state)) return false;
      if (matchStatuses && !matchStatuses.includes(item.matchStatus)) return false;
      if (minSeverity && SEVERITY_RANK[item.severity] < SEVERITY_RANK[minSeverity]) return false;
      if (master && !(item.master || '').toLowerCase().includes(master)) return false;
      if (dispatcher && !(item.dispatcher || '').toLowerCase().includes(dispatcher)) return false;
      if (repairKind && !(item.repairKind || '').toLowerCase().includes(repairKind)) return false;
      const dRef = dateField === 'basisStart'
        ? (item.dates.uchnStart)
        : (item.dates.factStart);
      const d = dRef ? new Date(dRef) : null;
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      if (q) {
        const hay = [
          item.orderNumber, item.planNumber, item.basis,
          item.vehicleText, item.brand, item.model, item.plateNumber1, item.plateNumber2, item.vin,
          item.master, item.dispatcher, item.repairKind,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }

    const filtered = all.filter(pass);

    // KPI
    const kpi = { total: filtered.length, matched: 0, noBasis: 0, basisNotFound: 0, vehicleMismatch: 0, severityOrangeOrRed: 0 };
    for (const it of filtered) {
      if (it.matchStatus === 'matched') kpi.matched++;
      else if (it.matchStatus === 'no_basis') kpi.noBasis++;
      else if (it.matchStatus === 'basis_not_found') kpi.basisNotFound++;
      else if (it.matchStatus === 'matched_vehicle_mismatch') kpi.vehicleMismatch++;
      if (it.severity === 'orange' || it.severity === 'red') kpi.severityOrangeOrRed++;
    }

    // Сортировка
    // По умолчанию — endAny DESC: «самая новая дата окончания» с каскадом
    // факт → уточн → план (для строк без факта используется уточн, иначе план).
    // Аналогично startAny для колонки «Начало».
    const sortBy = req.query.sortBy || 'endAny';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    function getSortVal(it) {
      switch (sortBy) {
        case 'orderNumber': return it.orderNumber;
        case 'state': return it.state;
        case 'master': return it.master;
        case 'dispatcher': return it.dispatcher;
        case 'matchStatus': return it.matchStatus;
        case 'planStart': return it.dates.planStart;
        case 'planEnd': return it.dates.planEnd;
        case 'uchnStart': return it.dates.uchnStart;
        case 'uchnEnd': return it.dates.uchnEnd;
        case 'factStart': return it.dates.factStart;
        case 'factEnd': return it.dates.factEnd;
        case 'startAny': return it.dates.factStart || it.dates.uchnStart || it.dates.planStart;
        case 'endAny':   return it.dates.factEnd   || it.dates.uchnEnd   || it.dates.planEnd;
        case 'deltaPlan': return it.durations.deltaPlan;
        case 'deltaUchn': return it.durations.deltaUchn;
        default: return it.dates.factEnd || it.dates.uchnEnd || it.dates.planEnd;
      }
    }
    function cmp(a, b) {
      const va = getSortVal(a);
      const vb = getSortVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      const ta = new Date(va).getTime();
      const tb = new Date(vb).getTime();
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return (ta - tb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    }
    filtered.sort(cmp);

    // Пагинация
    const take = Math.min(parseInt(req.query.take, 10) || 100, 1000);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const items = filtered.slice(skip, skip + take);

    res.json({ items, total: filtered.length, kpi, take, skip });
  } catch (err) {
    logger.error('GET /oneC/matching failed', { err: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/oneC/matching/closed — «Закр. ЗН ↔ Заказ-наряды и Заявки»
//
// База — «Закрытые ЗН» (deduped performed). Для каждой строки по orderNumber
// подтягиваем последний repair-snapshot (для basis/uchn-дат и фактических
// меток работы) и через basis → plan-rows (охватывающий интервал). Считаем
// четыре длительности (план / уточн / факт / закр−факт) и флаг отклонения
// факта от нормочасов (>30%).
// ---------------------------------------------------------------------------
const NORM_MISMATCH_THRESHOLD = 0.3;

// Дополнительная подсветка строки по сопоставлению Δфакт ↔ нормочасы.
// Возвращает { mismatch: bool, ratio: number|null } где ratio = (Δфакт − norm) / norm.
function normVsFact(normHours, deltaFactSec) {
  if (normHours == null || normHours <= 0) return { mismatch: false, ratio: null };
  if (deltaFactSec == null || deltaFactSec <= 0) return { mismatch: false, ratio: null };
  const normSec = Number(normHours) * 3600;
  if (!Number.isFinite(normSec) || normSec <= 0) return { mismatch: false, ratio: null };
  const ratio = (deltaFactSec - normSec) / normSec;
  return { mismatch: Math.abs(ratio) > NORM_MISMATCH_THRESHOLD, ratio };
}

router.get('/matching/closed', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const [performed, repairs, plans] = await Promise.all([
      deduped.getDedupedPerformedRows(),
      deduped.getDedupedRepairRows(),
      deduped.getDedupedPlanRows(),
    ]);

    // plan rows by documentText
    const planByDoc = new Map();
    for (const p of plans) {
      const key = p.documentText || '';
      if (!key) continue;
      if (!planByDoc.has(key)) planByDoc.set(key, []);
      planByDoc.get(key).push(p);
    }

    // Последняя версия repair по orderNumber (для basis/dates).
    const latestRepairByOrder = new Map();
    for (const r of repairs) {
      const key = r.orderNumber;
      if (!key) continue;
      const cur = latestRepairByOrder.get(key);
      const t = r.receivedAt ? new Date(r.receivedAt).getTime() : 0;
      const tc = cur && cur.receivedAt ? new Date(cur.receivedAt).getTime() : -1;
      if (!cur || t > tc) latestRepairByOrder.set(key, r);
    }

    // Последняя версия performed по orderNumber — берём как «представитель»
    // закрытого ЗН (на UI-вкладке «Закрытые ЗН» отображается ровно это).
    const latestPerformedByOrder = new Map();
    for (const p of performed) {
      const key = p.orderNumber;
      if (!key) continue;
      const cur = latestPerformedByOrder.get(key);
      const t = p.receivedAt ? new Date(p.receivedAt).getTime() : 0;
      const tc = cur && cur.receivedAt ? new Date(cur.receivedAt).getTime() : -1;
      if (!cur || t > tc) latestPerformedByOrder.set(key, p);
    }

    const all = Array.from(latestPerformedByOrder.values()).map((p) => {
      const r = latestRepairByOrder.get(p.orderNumber) || null;
      const basis = r ? (r.basis || null) : null;
      const planRows = basis ? (planByDoc.get(basis) || []) : [];
      const { planStart, planEnd } = planSpan(planRows);

      // uchn (basisStart/End) и fact (work_started_at/work_finished_at) — из repair-snapshot.
      const uchnStart = r ? (r.basisStart || null) : null;
      const uchnEnd   = r ? (r.basisEnd   || null) : null;
      const factStart = r ? (r.workStartedAt  || null) : p.workStartedAt  || null;
      const factEnd   = r ? (r.workFinishedAt || null) : p.workFinishedAt || null;
      const closedAt  = p.closedAt || (r ? r.closedAt : null);

      const tPlan   = durationSec(planStart, planEnd);
      const tUchn   = durationSec(uchnStart, uchnEnd);
      const tFact   = durationSec(factStart, factEnd);
      const tClosed = durationSec(factEnd, closedAt); // закрытие − окончание работ (факт)

      const normHours = (p.normHours != null && p.normHours !== '') ? Number(p.normHours) : null;
      const norm = normVsFact(normHours, tFact);

      return {
        id: p.id,
        orderNumber: p.orderNumber,
        state: p.state || (r ? r.state : null),
        repairKind: p.repairKind || (r ? r.repairKind : null),
        vehicleText: p.vehicleText || (r ? r.vehicleText : null),
        brand: p.brand || (r ? r.brand : null),
        model: p.model || (r ? r.model : null),
        plateNumber: p.plateNumber || (r ? (r.plateNumber1 || r.plateNumber2) : null),
        vin: p.vin || (r ? r.vin : null),
        master: p.master || (r ? r.master : null),
        executor: p.executor || null,
        causeDescription: p.causeDescription || null,
        basis,
        hasRepair: !!r,
        hasPlan: planRows.length > 0,
        closedAt,
        receivedAt: p.receivedAt || null,
        normHours,
        dates: { planStart, planEnd, uchnStart, uchnEnd, factStart, factEnd, closedAt },
        durations: {
          tPlan, tUchn, tFact, tClosed,
        },
        norm: {
          mismatch: norm.mismatch,
          ratio: norm.ratio, // (Δфакт − norm) / norm; >0 — превышение, <0 — экономия
        },
      };
    });

    // Фильтры
    const q = req.query.q ? String(req.query.q).toLowerCase() : null;
    const onlyMismatch = req.query.onlyMismatch === '1' || req.query.onlyMismatch === 'true';
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to   = req.query.to   ? new Date(String(req.query.to))   : null;

    function pass(item) {
      if (onlyMismatch && !item.norm.mismatch) return false;
      const d = item.closedAt ? new Date(item.closedAt) : null;
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      if (q) {
        const hay = [
          item.orderNumber, item.basis,
          item.vehicleText, item.brand, item.model, item.plateNumber, item.vin,
          item.master, item.executor, item.repairKind, item.state, item.causeDescription,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }

    const filtered = all.filter(pass);

    // KPI
    const kpi = {
      total: filtered.length,
      mismatch: filtered.filter((x) => x.norm.mismatch).length,
      overrun:  filtered.filter((x) => x.norm.ratio != null && x.norm.ratio > NORM_MISMATCH_THRESHOLD).length,
      saved:    filtered.filter((x) => x.norm.ratio != null && x.norm.ratio < -NORM_MISMATCH_THRESHOLD).length,
      noNorm:   filtered.filter((x) => x.normHours == null || x.normHours <= 0).length,
    };

    // Сортировка
    const sortBy  = req.query.sortBy || 'closedAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    function getSortVal(it) {
      switch (sortBy) {
        case 'orderNumber': return it.orderNumber;
        case 'closedAt':    return it.closedAt;
        case 'normHours':   return it.normHours;
        case 'tPlan':       return it.durations.tPlan;
        case 'tUchn':       return it.durations.tUchn;
        case 'tFact':       return it.durations.tFact;
        case 'tClosed':     return it.durations.tClosed;
        case 'ratio':       return it.norm.ratio;
        default:            return it.closedAt;
      }
    }
    function cmp(a, b) {
      const va = getSortVal(a);
      const vb = getSortVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      const ta = new Date(va).getTime();
      const tb = new Date(vb).getTime();
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return (ta - tb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    }
    filtered.sort(cmp);

    const take = Math.min(parseInt(req.query.take, 10) || 100, 1000);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const items = filtered.slice(skip, skip + take);

    res.json({ items, total: filtered.length, kpi, take, skip, threshold: NORM_MISMATCH_THRESHOLD });
  } catch (err) {
    logger.error('GET /oneC/matching/closed failed', { err: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
