// Уведомления о новых нестыковках 1С↔CV.
//
// notify(discrepancy):
//   1. io.emit('discrepancy:new', payload) — для Sidebar-бейджа и NotificationCenter.
//   2. Если severity === 'critical':
//      - Telegram broadcast (всем привязанным linked users).
//      - PWA push (всем PushSubscription).
//
// Все ошибки логируются и проглатываются — нотификатор не должен ломать детектор.

const logger = require('../config/logger');
const prisma = require('../config/database');
const { getIO } = require('../config/socket');
const telegramBot = require('./telegramBot');

let webpush = null;
try {
  webpush = require('web-push');
} catch (err) {
  logger.info('discrepancyNotifier: web-push not available', { err: err.message });
}

const TYPE_LABELS_RU = {
  no_show_in_cv: 'Нет визита по CV',
  no_show_in_1c: 'Нет записи в 1С',
  wrong_post: 'Неверный пост',
  overstated_norm_hours: 'Завышена норма',
  understated_actual_time: 'Занижено фактическое время',
  time_mismatch: 'Расхождение по времени',
};

function formatDiscrepancyForTelegram(d) {
  const lines = [];
  const icon = d.severity === 'critical' ? '🚨' : d.severity === 'warning' ? '⚠️' : 'ℹ️';
  lines.push(`${icon} <b>Нестыковка: ${TYPE_LABELS_RU[d.type] || d.type}</b>`);
  if (d.orderNumber) lines.push(`Заказ-наряд: <code>${d.orderNumber}</code>`);
  if (d.plateNumber) lines.push(`Номер: <b>${d.plateNumber}</b>`);
  lines.push(`Severity: <b>${d.severity}</b>`);
  lines.push('');
  lines.push(d.description);
  return lines.join('\n');
}

async function emitSocket(d) {
  try {
    const io = getIO();
    io.emit('discrepancy:new', {
      id: d.id,
      type: d.type,
      severity: d.severity,
      status: d.status,
      orderNumber: d.orderNumber,
      postId: d.postId,
      vehicleSessionId: d.vehicleSessionId,
      description: d.description,
      detectedAt: d.detectedAt,
    });
  } catch (err) {
    logger.warn('discrepancyNotifier: socket emit failed', { err: err.message });
  }
}

async function sendTelegram(d) {
  try {
    const text = formatDiscrepancyForTelegram(d);
    // broadcastTelegram использует HTML-парсинг? В telegramBot.broadcastTelegram нет parse_mode —
    // отправим без HTML-тегов, чтобы не ломать рендер.
    const plainText = text.replace(/<[^>]+>/g, '');
    await telegramBot.broadcastTelegram(plainText);
  } catch (err) {
    logger.warn('discrepancyNotifier: telegram broadcast failed', { err: err.message });
  }
}

async function sendPwaPush(d) {
  if (!webpush) return;
  try {
    const subs = await prisma.pushSubscription.findMany();
    if (!subs.length) return;
    const payload = JSON.stringify({
      title: `🚨 ${TYPE_LABELS_RU[d.type] || 'Нестыковка'}`,
      body: d.description,
      url: '/#/discrepancies',
      tag: `discrepancy-${d.id}`,
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) },
          payload
        );
      } catch (err) {
        if (err && err.statusCode === 410) {
          // Subscription expired — clean up
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.warn('discrepancyNotifier: PWA push failed', { err: err.message });
  }
}

// Главная: вызывается из discrepancyDetector сразу после INSERT.
async function notify(discrepancy) {
  if (!discrepancy) return;
  await emitSocket(discrepancy);
  if (discrepancy.severity === 'critical') {
    // Параллельно, не блокируя друг друга
    Promise.allSettled([sendTelegram(discrepancy), sendPwaPush(discrepancy)]).catch(() => {});
  }
}

module.exports = {
  notify,
  // exposed for tests
  _formatDiscrepancyForTelegram: formatDiscrepancyForTelegram,
};
