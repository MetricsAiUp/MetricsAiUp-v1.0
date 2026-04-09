const cron = require('node-cron');
const prisma = require('../config/database');
const { generateReportXlsx } = require('./serverExport');

function shouldRun(schedule, now) {
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
  if (schedule.lastRunAt) {
    const last = new Date(schedule.lastRunAt);
    if (last.toDateString() === now.toDateString()) return false;
  }
  if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && now.getDay() !== schedule.dayOfWeek) return false;
  return true;
}

function startReportScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
      const now = new Date();
      for (const s of schedules) {
        if (shouldRun(s, now)) {
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
            console.log(`Report sent: ${s.name}`);
          } catch (err) { console.error(`Report error for ${s.name}:`, err.message); }
        }
      }
    } catch {}
  });
  console.log('Report scheduler started');
}

module.exports = { startReportScheduler };
