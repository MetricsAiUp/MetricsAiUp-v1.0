/**
 * Backup Scheduler
 *
 * Daily SQLite snapshot at 03:00 via VACUUM INTO (consistent with WAL,
 * works on a live DB). Three-tier retention:
 *   daily/    — last 7 (ежедневно)
 *   weekly/   — last 4 (копия из daily по воскресеньям)
 *   monthly/  — last 12 (копия из daily 1-го числа)
 *
 * Также экспортирует createBackup() для ручного триггера через /api/backup.
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const prisma = require('../config/database');
const logger = require('../config/logger');

const BACKUP_ROOT = '/project/backups';
const DAILY_DIR = path.join(BACKUP_ROOT, 'daily');
const WEEKLY_DIR = path.join(BACKUP_ROOT, 'weekly');
const MONTHLY_DIR = path.join(BACKUP_ROOT, 'monthly');

const KEEP_DAILY = 7;
const KEEP_WEEKLY = 4;
const KEEP_MONTHLY = 12;

let cronTask = null;

function ensureDirs() {
  for (const dir of [DAILY_DIR, WEEKLY_DIR, MONTHLY_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function fmtTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function vacuumInto(targetPath) {
  // VACUUM INTO 'path' — атомарный snapshot, корректно работает с WAL и
  // открытыми соединениями. Путь формируется из timestamp, спецсимволов нет,
  // но на всякий случай экранируем одинарную кавычку.
  const safe = targetPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${safe}'`);
}

function pruneDir(dir, keep) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.db'));
  } catch {
    return 0;
  }
  // Имена с timestamp — лексикографическая сортировка совпадает с временной.
  files.sort();
  const toDelete = files.length > keep ? files.slice(0, files.length - keep) : [];
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch (err) {
      logger.error('Backup prune failed', { file: f, error: err.message });
    }
  }
  return toDelete.length;
}

async function createBackup(label = 'manual') {
  ensureDirs();
  const now = new Date();
  const ts = fmtTimestamp(now);
  const filename = `dev-${ts}.db`;
  const targetPath = path.join(DAILY_DIR, filename);

  const t0 = Date.now();
  try {
    await vacuumInto(targetPath);
  } catch (err) {
    logger.error('Backup failed', { error: err.message, label, target: targetPath });
    return { success: false, error: err.message };
  }
  const durationMs = Date.now() - t0;
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(targetPath).size;
  } catch {
    /* ignore */
  }

  // Воскресенье → копия в weekly/
  if (now.getDay() === 0) {
    const weekly = path.join(WEEKLY_DIR, `dev-week-${ts}.db`);
    try {
      fs.copyFileSync(targetPath, weekly);
    } catch (err) {
      logger.error('Weekly copy failed', { error: err.message });
    }
  }
  // 1-е число месяца → копия в monthly/
  if (now.getDate() === 1) {
    const monthly = path.join(MONTHLY_DIR, `dev-month-${ts}.db`);
    try {
      fs.copyFileSync(targetPath, monthly);
    } catch (err) {
      logger.error('Monthly copy failed', { error: err.message });
    }
  }

  const pruned = {
    daily: pruneDir(DAILY_DIR, KEEP_DAILY),
    weekly: pruneDir(WEEKLY_DIR, KEEP_WEEKLY),
    monthly: pruneDir(MONTHLY_DIR, KEEP_MONTHLY),
  };

  logger.info('Backup created', {
    label,
    file: filename,
    durationMs,
    sizeBytes,
    pruned,
  });
  return { success: true, file: filename, path: targetPath, sizeBytes, durationMs, pruned };
}

function listBackups() {
  ensureDirs();
  const list = (dir) => {
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.db'))
        .map((f) => {
          const fp = path.join(dir, f);
          const st = fs.statSync(fp);
          return { name: f, sizeBytes: st.size, mtime: st.mtime.toISOString() };
        })
        .sort((a, b) => b.mtime.localeCompare(a.mtime));
    } catch {
      return [];
    }
  };
  return {
    daily: list(DAILY_DIR),
    weekly: list(WEEKLY_DIR),
    monthly: list(MONTHLY_DIR),
  };
}

function start() {
  if (cronTask) return;
  ensureDirs();
  // Каждый день в 03:00 локального времени контейнера.
  cronTask = cron.schedule('0 3 * * *', () => {
    createBackup('scheduled').catch((err) =>
      logger.error('Scheduled backup error', { error: err.message })
    );
  });
  logger.info('Backup scheduler started', {
    schedule: 'daily at 03:00',
    root: BACKUP_ROOT,
    retention: { daily: KEEP_DAILY, weekly: KEEP_WEEKLY, monthly: KEEP_MONTHLY },
  });
}

function stop() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = { start, stop, createBackup, listBackups };
