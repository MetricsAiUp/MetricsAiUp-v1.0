const cron = require('node-cron');
const prisma = require('../config/database');
const { generateReportXlsx } = require('./serverExport');
const logger = require('../config/logger');
const registry = require('./_serviceRegistry');
const settingsReader = require('../routes/settings');
const { tzOf, dateStrInTz, dayOfWeekInTz, hourMinuteInTz } = require('../utils/dateUtils');

// Все сравнения «час/минута/день недели» проводим в TZ Location (а не в TZ хоста),
// иначе на UTC-сервере «09:00 московское» сработает в 12:00.
function shouldRun(schedule, now, tz) {
  const { hour, minute } = hourMinuteInTz(now, tz);
  if (hour !== schedule.hour || minute !== schedule.minute) return false;
  if (schedule.lastRunAt) {
    const last = new Date(schedule.lastRunAt);
    if (dateStrInTz(last, tz) === dateStrInTz(now, tz)) return false;
  }
  if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && dayOfWeekInTz(now, tz) !== schedule.dayOfWeek) return false;
  return true;
}

function startReportScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      registry.tick('reportScheduler');
      const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
      const now = new Date();
      const tz = tzOf(settingsReader.readSettings());
      for (const s of schedules) {
        if (shouldRun(s, now, tz)) {
          try {
            const periodDays = s.frequency === 'daily' ? 1 : 7;
            const { buffer, filename } = await generateReportXlsx(periodDays);
            // Try to send via Telegram
            try {
              const { sendTelegramDocument, broadcastDocument } = require('./telegramBot');
              if (s.chatId) { await sendTelegramDocument(s.chatId, buffer, filename, `Report: ${filename}`); }
              else { await broadcastDocument(buffer, filename, `Report: ${filename}`); }
            } catch {}
            await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastRunAt: now } });
            logger.info('Report sent', { name: s.name });
          } catch (err) {
            registry.error('reportScheduler', err);
            logger.error('Report error', { name: s.name, error: err.message });
          }
        }
      }
    } catch (err) { registry.error('reportScheduler', err); }
  });
  registry.register('reportScheduler', { cron: '* * * * *' });
  logger.info('Report scheduler started');
}

module.exports = { startReportScheduler };
