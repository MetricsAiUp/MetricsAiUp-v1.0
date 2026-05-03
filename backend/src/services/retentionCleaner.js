/**
 * Retention Cleaner
 *
 * Раз в сутки (03:30, после бэкапа в 03:00) чистит старые записи из исторических
 * таблиц по настройкам из /api/settings.retention. Значение 0 = не чистить.
 *
 * Управляющие поля (см. routes/settings.js DEFAULT_SETTINGS.retention):
 *   - monitoringSnapshotDays — monitoring_snapshots по timestamp
 *   - auditLogDays           — audit_logs по createdAt
 *   - eventDays              — events по createdAt
 *   - syncLogCount           — sync_logs: оставлять последние N штук (по createdAt DESC)
 *   - recommendationDays     — recommendations со статусом resolved/acknowledged по updatedAt
 *
 * Никаких автоматических каскадов: чистим только перечисленные таблицы.
 */

const cron = require('node-cron');
const prisma = require('../config/database');
const logger = require('../config/logger');
const settingsRoutes = require('../routes/settings');
const registry = require('./_serviceRegistry');

let cronTask = null;

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function cleanMonitoringSnapshots(days) {
  if (!days) return 0;
  const cutoff = daysAgo(days);
  const res = await prisma.monitoringSnapshot.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });
  return res.count;
}

async function cleanAuditLogs(days) {
  if (!days) return 0;
  const cutoff = daysAgo(days);
  const res = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return res.count;
}

async function cleanEvents(days) {
  if (!days) return 0;
  const cutoff = daysAgo(days);
  const res = await prisma.event.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return res.count;
}

async function cleanSyncLogs(keep) {
  if (!keep) return 0;
  // Оставить последние `keep` штук по createdAt DESC, остальное удалить.
  const total = await prisma.syncLog.count();
  if (total <= keep) return 0;
  const cutoffRow = await prisma.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    skip: keep,
    take: 1,
    select: { createdAt: true },
  });
  if (!cutoffRow.length) return 0;
  const res = await prisma.syncLog.deleteMany({
    where: { createdAt: { lt: cutoffRow[0].createdAt } },
  });
  return res.count;
}

async function cleanRecommendations(days) {
  if (!days) return 0;
  const cutoff = daysAgo(days);
  // Активные оставляем; чистим только resolved/acknowledged.
  const res = await prisma.recommendation.deleteMany({
    where: {
      status: { in: ['resolved', 'acknowledged'] },
      updatedAt: { lt: cutoff },
    },
  });
  return res.count;
}

async function runOnce(label = 'scheduled') {
  const settings = settingsRoutes.readSettings();
  const r = settings.retention || {};
  const t0 = Date.now();
  const result = {
    monitoring_snapshots: 0,
    audit_logs: 0,
    events: 0,
    sync_logs: 0,
    recommendations: 0,
  };
  try {
    result.monitoring_snapshots = await cleanMonitoringSnapshots(r.monitoringSnapshotDays);
    result.audit_logs = await cleanAuditLogs(r.auditLogDays);
    result.events = await cleanEvents(r.eventDays);
    result.sync_logs = await cleanSyncLogs(r.syncLogCount);
    result.recommendations = await cleanRecommendations(r.recommendationDays);
  } catch (err) {
    registry.error('retentionCleaner', err);
    logger.error('Retention cleaner failed', { error: err.message, label });
    return { success: false, error: err.message };
  }
  const durationMs = Date.now() - t0;
  const totalDeleted = Object.values(result).reduce((a, b) => a + b, 0);
  registry.tick('retentionCleaner', { deleted: totalDeleted });
  logger.info('Retention cleaner finished', {
    label,
    durationMs,
    totalDeleted,
    deleted: result,
    settings: r,
  });
  return { success: true, durationMs, deleted: result };
}

function start() {
  if (cronTask) return;
  registry.register('retentionCleaner', { schedule: '30 3 * * *' });
  // 03:30 — после бэкапа в 03:00.
  cronTask = cron.schedule('30 3 * * *', () => {
    runOnce('scheduled').catch((err) =>
      logger.error('Scheduled retention error', { error: err.message })
    );
  });
  logger.info('Retention cleaner started', { schedule: 'daily at 03:30' });
}

function stop() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = { start, stop, runOnce };
