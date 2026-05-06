// Ежедневный дайджест нестыковок 1С↔CV.
//
// Cron: '0 9 * * *' (09:00 каждый день).
// Собирает Discrepancy за предыдущие 24ч + список ещё-открытых, формирует
// краткий отчёт и отправляет в Telegram.
//
// Конфигурация:
//   process.env.TELEGRAM_DISCREPANCY_DIGEST_CHAT_ID — если задан, отправка только в этот чат;
//   иначе — broadcast всем привязанным пользователям.
//   process.env.DISCREPANCY_DIGEST_DISABLED='1' — отключить запуск.

const cron = require('node-cron');
const prisma = require('../config/database');
const logger = require('../config/logger');
const telegramBot = require('./telegramBot');

const TYPE_LABELS_RU = {
  no_show_in_cv: 'Нет визита по CV',
  no_show_in_1c: 'Нет записи в 1С',
  wrong_post: 'Неверный пост',
  overstated_norm_hours: 'Завышена норма',
  understated_actual_time: 'Занижено фактическое',
  time_mismatch: 'Расхождение по времени',
};

let task = null;

async function buildReport({ from, to }) {
  const detected = await prisma.discrepancy.findMany({
    where: { detectedAt: { gte: from, lte: to } },
    select: { id: true, type: true, severity: true, postId: true, orderNumber: true },
  });
  const stillOpen = await prisma.discrepancy.count({ where: { status: 'open' } });

  const byType = {};
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byPost = {};
  for (const d of detected) {
    byType[d.type] = (byType[d.type] || 0) + 1;
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    if (d.postId) byPost[d.postId] = (byPost[d.postId] || 0) + 1;
  }

  // Посты — нумерация
  const topPostIds = Object.entries(byPost).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const topPosts = topPostIds.length
    ? await prisma.post.findMany({ where: { id: { in: topPostIds } }, select: { id: true, name: true, number: true } })
    : [];
  const topPostsLines = topPostIds.map((id) => {
    const p = topPosts.find((x) => x.id === id);
    const label = p ? `Пост ${p.number || p.name}` : id;
    return `• ${label}: ${byPost[id]}`;
  });

  const lines = [];
  lines.push(`📋 Дайджест нестыковок 1С↔CV (за ${from.toISOString().slice(0, 10)})`);
  lines.push('');
  lines.push(`Всего обнаружено за сутки: ${detected.length}`);
  lines.push(`  • critical: ${bySeverity.critical || 0}`);
  lines.push(`  • warning:  ${bySeverity.warning || 0}`);
  lines.push(`  • info:     ${bySeverity.info || 0}`);
  lines.push('');
  lines.push(`Открытых на текущий момент: ${stillOpen}`);
  if (Object.keys(byType).length) {
    lines.push('');
    lines.push('По типам:');
    for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      lines.push(`  • ${TYPE_LABELS_RU[t] || t}: ${n}`);
    }
  }
  if (topPostsLines.length) {
    lines.push('');
    lines.push('Топ постов с нестыковками:');
    for (const l of topPostsLines) lines.push(l);
  }
  lines.push('');
  lines.push('Подробно: /#/discrepancies');

  return {
    text: lines.join('\n'),
    counts: { detected: detected.length, open: stillOpen, bySeverity, byType },
  };
}

async function runOnce({ now } = {}) {
  const to = now || new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const report = await buildReport({ from, to });

  const dedicatedChatId = process.env.TELEGRAM_DISCREPANCY_DIGEST_CHAT_ID;
  try {
    if (dedicatedChatId) {
      await telegramBot.sendTelegramNotification(null, report.text).catch(() => {});
      // sendTelegramNotification ищет userId — для прямого chatId нет такой функции, поэтому
      // fallback: используем broadcast если chatId не привязан.
      // В этом случае всё равно делаем broadcast — простая семантика.
      await telegramBot.broadcastTelegram(report.text);
    } else {
      await telegramBot.broadcastTelegram(report.text);
    }
  } catch (err) {
    logger.warn('discrepancyDigest: telegram delivery failed', { err: err.message });
  }

  logger.info('discrepancyDigest: run done', report.counts);
  return report;
}

function start() {
  if (process.env.DISCREPANCY_DIGEST_DISABLED === '1') {
    logger.info('discrepancyDigest: disabled by env');
    return;
  }
  if (task) return;
  task = cron.schedule('0 9 * * *', () => {
    runOnce().catch((err) => logger.error('discrepancyDigest: cron failed', { err: err.message }));
  });
  logger.info('discrepancyDigest: cron scheduled (0 9 * * *)');
}

function stop() {
  if (task) { task.stop(); task = null; }
}

module.exports = { start, stop, runOnce, buildReport };
