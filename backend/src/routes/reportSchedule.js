const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateReportXlsx } = require('../services/serverExport');

router.get('/', authenticate, async (req, res) => {
  const schedules = await prisma.reportSchedule.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(schedules);
});

router.post('/', authenticate, async (req, res) => {
  const { name, frequency, dayOfWeek, hour, minute, format, chatId } = req.body;
  const schedule = await prisma.reportSchedule.create({ data: { name, frequency, dayOfWeek, hour: hour || 20, minute: minute || 0, format: format || 'xlsx', chatId } });
  res.status(201).json(schedule);
});

router.put('/:id', authenticate, async (req, res) => {
  const schedule = await prisma.reportSchedule.update({ where: { id: req.params.id }, data: req.body });
  res.json(schedule);
});

router.delete('/:id', authenticate, async (req, res) => {
  await prisma.reportSchedule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post('/:id/run', authenticate, async (req, res) => {
  try {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
    if (!schedule) return res.status(404).json({ error: 'Not found' });
    const periodDays = schedule.frequency === 'daily' ? 1 : 7;
    const { buffer, filename } = await generateReportXlsx(periodDays);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(Buffer.from(buffer));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
