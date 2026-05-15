// Планировщик автоматического запуска discrepancyDetector.
//
// Конфиг + state хранятся в JSON-файле (single-row), чтобы не плодить миграции:
//   backend/data/discrepancy-scheduler.json
//
// Поля:
//   enabled       boolean        — включён ли автозапуск
//   time          'HH:MM'        — локальное время старта в указанной timezone
//   timezone      IANA TZ        — часовой пояс
//   sinceWindow   '7d'|'24h'|... — окно для detectAll
//   lastRunAt     ISO            — когда стартовал последний запуск
//   lastFinishAt  ISO            — когда завершился
//   lastStatus    string         — 'ok' | 'error' | 'running'
//   lastDurationMs number
//   lastDetected  number
//   lastNew       number
//   lastError     string|null
//   lastTrigger   'manual'|'cron'
//
// Cron-такс пере-планируется при изменении config (PUT /api/discrepancies/schedule).
// Запуск detectAll происходит в фоне; HTTP /run возвращает 202 сразу.

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const logger = require('../config/logger');
const detector = require('./discrepancyDetector');

const STATE_FILE = path.join(__dirname, '../../data/discrepancy-scheduler.json');

const DEFAULT_STATE = {
  enabled: true,
  time: '08:00',
  timezone: 'Europe/Moscow',
  sinceWindow: '7d',
  lastRunAt: null,
  lastFinishAt: null,
  lastStatus: null,
  lastDurationMs: null,
  lastDetected: null,
  lastNew: null,
  lastError: null,
  lastTrigger: null,
};

let task = null;
let runningPromise = null;

function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
  catch { return false; }
}

function isValidTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function timeToCron(timeHHMM) {
  const [hh, mm] = timeHHMM.split(':').map((x) => parseInt(x, 10));
  return `${mm} ${hh} * * *`;
}

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return { ...DEFAULT_STATE, ...raw };
    }
  } catch (err) {
    logger.warn('discrepancyDetectorScheduler: read state failed', { err: err.message });
  }
  return { ...DEFAULT_STATE };
}

function writeState(data) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('discrepancyDetectorScheduler: write state failed', { err: err.message });
  }
}

function patchState(patch) {
  const cur = readState();
  const next = { ...cur, ...patch };
  writeState(next);
  return next;
}

function getState() {
  const s = readState();
  return { ...s, isRunning: !!runningPromise };
}

// Запустить detectAll и обновить lastRun*-поля.
// Если уже запущено — вернуть текущий промис.
async function runOnce({ trigger = 'manual', since } = {}) {
  if (runningPromise) {
    logger.info('discrepancyDetectorScheduler: run skipped (already running)');
    return runningPromise;
  }
  const state = readState();
  const sinceWindow = since || state.sinceWindow || '7d';
  const startedAt = new Date();
  patchState({
    lastRunAt: startedAt.toISOString(),
    lastStatus: 'running',
    lastTrigger: trigger,
    lastError: null,
  });

  runningPromise = (async () => {
    const t0 = Date.now();
    try {
      logger.info('discrepancyDetectorScheduler: run start', { trigger, sinceWindow });
      const result = await detector.detectAll({ since: sinceWindow });
      const durationMs = Date.now() - t0;
      const finishedAt = new Date();
      patchState({
        lastFinishAt: finishedAt.toISOString(),
        lastStatus: 'ok',
        lastDurationMs: durationMs,
        lastDetected: result?.totalDetected ?? 0,
        lastNew: result?.totalNew ?? 0,
        lastError: null,
      });
      logger.info('discrepancyDetectorScheduler: run done', { trigger, durationMs, ...result });
      return { ok: true, ...result, durationMs };
    } catch (err) {
      const durationMs = Date.now() - t0;
      const finishedAt = new Date();
      patchState({
        lastFinishAt: finishedAt.toISOString(),
        lastStatus: 'error',
        lastDurationMs: durationMs,
        lastError: (err.message || String(err)).slice(0, 1000),
      });
      logger.error('discrepancyDetectorScheduler: run failed', { trigger, err: err.message });
      return { ok: false, error: err.message, durationMs };
    } finally {
      runningPromise = null;
    }
  })();
  return runningPromise;
}

function scheduleCron(state) {
  if (task) { try { task.stop(); } catch { /* */ } task = null; }
  if (!state.enabled) {
    logger.info('discrepancyDetectorScheduler: disabled');
    return;
  }
  if (!isValidTime(state.time)) {
    logger.warn('discrepancyDetectorScheduler: invalid time, skip', { time: state.time });
    return;
  }
  if (!isValidTimezone(state.timezone)) {
    logger.warn('discrepancyDetectorScheduler: invalid timezone, skip', { timezone: state.timezone });
    return;
  }
  const expr = timeToCron(state.time);
  task = cron.schedule(expr, () => {
    runOnce({ trigger: 'cron' }).catch((err) => {
      logger.error('discrepancyDetectorScheduler: cron run failed', { err: err.message });
    });
  }, { timezone: state.timezone });
  logger.info('discrepancyDetectorScheduler: cron scheduled', { expr, timezone: state.timezone });
}

function start() {
  // Гарантируем существование state-файла
  if (!fs.existsSync(STATE_FILE)) writeState({ ...DEFAULT_STATE });
  const state = readState();
  scheduleCron(state);
}

function stop() {
  if (task) { try { task.stop(); } catch { /* */ } task = null; }
}

// Обновить конфиг и пере-планировать. Возвращает текущий state.
function setConfig(patch) {
  const cur = readState();
  const next = { ...cur };
  if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
  if (patch.time !== undefined) {
    if (!isValidTime(patch.time)) throw new Error(`Invalid time format (expected HH:MM): ${patch.time}`);
    next.time = patch.time;
  }
  if (patch.timezone !== undefined) {
    if (!isValidTimezone(patch.timezone)) throw new Error(`Invalid timezone: ${patch.timezone}`);
    next.timezone = patch.timezone;
  }
  if (patch.sinceWindow !== undefined) {
    if (typeof patch.sinceWindow !== 'string' || !/^\d+\s*[hdw]$/.test(patch.sinceWindow)) {
      throw new Error(`Invalid sinceWindow (expected like "7d", "24h"): ${patch.sinceWindow}`);
    }
    next.sinceWindow = patch.sinceWindow;
  }
  writeState(next);
  scheduleCron(next);
  return getState();
}

module.exports = {
  start,
  stop,
  setConfig,
  getState,
  runOnce,
  // exposed for tests
  _readState: readState,
  _writeState: writeState,
  _STATE_FILE: STATE_FILE,
};
