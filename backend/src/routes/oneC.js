// REST API для нового /data-1c.
// Все эндпоинты под `/api/oneC/*`.
//
// Permissions:
//   view_1c              — чтение (config маскируется)
//   manage_1c_config     — RW конфига IMAP + test connection
//   manage_1c_import     — ручной запуск IMAP / upload xlsx / resolve unmapped posts

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { encrypt } = require('../utils/crypto');
const merger = require('../services/oneCMerger');
const oneCImporter = require('../services/oneCImporter');
const imap1cFetcher = require('../services/imap1cFetcher');
const { imap1cConfigUpdateSchema, testConnectionSchema, resolveUnmappedPostSchema } = require('../schemas/oneC');

const MASK = '****';

// helpers --------------------------------------------------------------------

function pickPublicConfig(cfg) {
  if (!cfg) return null;
  const { passwordEncrypted, ...rest } = cfg;
  return { ...rest, passwordSet: !!passwordEncrypted, password: MASK };
}

function parseInteger(v, def, max = 1000) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return def;
  return Math.min(n, max);
}

// /config --------------------------------------------------------------------

// GET /api/oneC/config
router.get('/config', authenticate, requirePermission('manage_1c_config'), async (req, res) => {
  try {
    const cfg = await prisma.imap1CConfig.findUnique({ where: { id: 1 } });
    if (!cfg) {
      const created = await prisma.imap1CConfig.create({ data: { id: 1 } });
      return res.json(pickPublicConfig(created));
    }
    res.json(pickPublicConfig(cfg));
  } catch (err) {
    logger.error('GET /oneC/config failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/oneC/config
router.put(
  '/config',
  authenticate,
  requirePermission('manage_1c_config'),
  validate(imap1cConfigUpdateSchema),
  async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.password !== undefined) {
        if (data.password === '' || data.password === MASK) {
          // Не обновляем пароль
          delete data.password;
        } else {
          data.passwordEncrypted = encrypt(data.password);
          delete data.password;
        }
      }
      // Гарантируем строку id=1
      const existing = await prisma.imap1CConfig.findUnique({ where: { id: 1 } });
      const updated = existing
        ? await prisma.imap1CConfig.update({ where: { id: 1 }, data })
        : await prisma.imap1CConfig.create({ data: { id: 1, ...data } });

      // Перепланируем cron, если был старт
      try { await imap1cFetcher.reschedule(); } catch (e) { logger.warn('reschedule failed', { err: e.message }); }

      res.json(pickPublicConfig(updated));
    } catch (err) {
      logger.error('PUT /oneC/config failed', { err: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/oneC/config/test  — проверка соединения без сохранения
router.post(
  '/config/test',
  authenticate,
  requirePermission('manage_1c_config'),
  validate(testConnectionSchema),
  async (req, res) => {
    const result = await imap1cFetcher.testConnection(req.body);
    res.json(result);
  }
);

// /imports -------------------------------------------------------------------

// GET /api/oneC/imports?status=...&take=&skip=
router.get('/imports', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.detectedType) where.detectedType = String(req.query.detectedType);

    const [items, total] = await Promise.all([
      prisma.oneCImport.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take,
        skip,
        select: {
          id: true, uid: true, messageId: true, fromAddress: true, subject: true, receivedAt: true,
          status: true, source: true, detectedType: true, attachmentName: true, attachmentSize: true,
          rowsTotal: true, rowsInserted: true, errorMessage: true, processedAt: true, createdAt: true,
        },
      }),
      prisma.oneCImport.count({ where }),
    ]);
    res.json({ items, total, take, skip });
  } catch (err) {
    logger.error('GET /oneC/imports failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oneC/imports/:id
router.get('/imports/:id', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const imp = await prisma.oneCImport.findUnique({ where: { id: req.params.id } });
    if (!imp) return res.status(404).json({ error: 'Import not found' });
    res.json(imp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oneC/imports/run — форс цикла IMAP
router.post('/imports/run', authenticate, requirePermission('manage_1c_import'), async (req, res) => {
  try {
    const result = await imap1cFetcher.fetchOnce({ manual: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oneC/imports/upload — manual upload (base64 в JSON-теле)
// Body: { filename: string, data: base64, forceType?: 'plan'|'repair'|'performed' }
router.post('/imports/upload', authenticate, requirePermission('manage_1c_import'), async (req, res) => {
  try {
    const { filename, data, forceType } = req.body || {};
    if (!filename || !data) return res.status(400).json({ error: 'filename and data (base64) required' });
    if (forceType && !['plan', 'repair', 'performed'].includes(forceType)) {
      return res.status(400).json({ error: 'forceType must be plan|repair|performed' });
    }
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'empty buffer' });

    const importRecord = await prisma.oneCImport.create({
      data: {
        uid: `manual-${Date.now()}`,
        fromAddress: req.user?.email || 'manual-upload',
        subject: `Manual upload: ${filename}`,
        receivedAt: new Date(),
        status: 'pending',
        source: 'manual',
        attachmentName: filename,
        attachmentSize: buffer.length,
      },
    });
    const result = await oneCImporter.process(importRecord, buffer, forceType ? { forceType } : {});
    res.json({ importId: importRecord.id, ...result });
  } catch (err) {
    logger.error('POST /oneC/imports/upload failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// /current -------------------------------------------------------------------

// GET /api/oneC/current?take=&skip=&state=&plate=&search=
router.get('/current', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const take = parseInteger(req.query.take, 100, 1000);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const rows = await merger.getWorkOrderCurrent({ take, skip });

    // Лёгкая фильтрация в JS (объёмы умеренные)
    let filtered = rows;
    if (req.query.state) {
      const st = String(req.query.state);
      filtered = filtered.filter((r) => r.state === st);
    }
    if (req.query.plate) {
      const p = String(req.query.plate).toUpperCase();
      filtered = filtered.filter((r) => (r.plate_number || '').toUpperCase().includes(p));
    }
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      filtered = filtered.filter((r) =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.vin || '').toLowerCase().includes(q) ||
        (r.plate_number || '').toLowerCase().includes(q) ||
        (r.executor || '').toLowerCase().includes(q)
      );
    }
    res.json({ items: filtered, total: filtered.length });
  } catch (err) {
    logger.error('GET /oneC/current failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oneC/stages/current?orderNumber=
router.get('/stages/current', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const orderNumber = req.query.orderNumber ? String(req.query.orderNumber) : undefined;
    const take = parseInteger(req.query.take, 200, 2000);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const rows = await merger.getStageCurrent({ orderNumber, take, skip });
    res.json({ items: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /raw/:type -----------------------------------------------------------------

const RAW_MODELS = {
  plan: { delegate: 'oneCPlanRow', orderField: 'receivedAt' },
  repair: { delegate: 'oneCRepairSnapshot', orderField: 'receivedAt' },
  performed: { delegate: 'oneCWorkPerformed', orderField: 'receivedAt' },
};

router.get('/raw/:type', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const meta = RAW_MODELS[req.params.type];
    if (!meta) return res.status(400).json({ error: 'type must be plan|repair|performed' });
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const where = {};
    if (req.query.orderNumber) {
      // plan-таблица использует поле number
      if (req.params.type === 'plan') where.number = String(req.query.orderNumber);
      else where.orderNumber = String(req.query.orderNumber);
    }
    if (req.query.importId) where.importId = String(req.query.importId);
    const items = await prisma[meta.delegate].findMany({
      where,
      orderBy: { [meta.orderField]: 'desc' },
      take,
      skip,
    });
    const total = await prisma[meta.delegate].count({ where });
    res.json({ items, total, take, skip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /payroll — агрегация выработки исполнителей по OneCWorkPerformed (current)
// Формула: по последнему performed-снимку для каждого orderNumber суммируем normHours
// в разбивке executor + период.
router.get('/payroll', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    // Берём latest performed per orderNumber через raw SQL
    const sql = `
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY received_at DESC) AS rn
        FROM one_c_work_performed
      ) WHERE rn = 1
    `;
    const rows = await prisma.$queryRawUnsafe(sql);
    const filtered = rows.filter((r) => {
      const closed = r.closed_at ? new Date(r.closed_at) : null;
      if (from && (!closed || closed < from)) return false;
      if (to && (!closed || closed > to)) return false;
      return true;
    });

    const byExecutor = new Map();
    for (const r of filtered) {
      const key = r.executor || '— не указан —';
      if (!byExecutor.has(key)) byExecutor.set(key, { executor: key, normHours: 0, orders: 0, repairs: new Map() });
      const acc = byExecutor.get(key);
      acc.normHours += Number(r.norm_hours) || 0;
      acc.orders += 1;
      const rk = r.repair_kind || '—';
      acc.repairs.set(rk, (acc.repairs.get(rk) || 0) + 1);
    }
    const items = [...byExecutor.values()]
      .map((x) => ({
        executor: x.executor,
        normHours: Math.round(x.normHours * 10) / 10,
        orders: x.orders,
        repairKinds: [...x.repairs.entries()].map(([k, v]) => ({ kind: k, count: v })),
      }))
      .sort((a, b) => b.normHours - a.normHours);

    const totalNorm = items.reduce((s, x) => s + x.normHours, 0);
    res.json({ items, totalNorm: Math.round(totalNorm * 10) / 10, from, to });
  } catch (err) {
    logger.error('GET /oneC/payroll failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// /unmapped-posts ------------------------------------------------------------

router.get('/unmapped-posts', authenticate, requirePermission('manage_1c_import'), async (req, res) => {
  try {
    const items = await prisma.oneCUnmappedPost.findMany({
      orderBy: [{ resolved: 'asc' }, { lastSeenAt: 'desc' }],
    });
    res.json({ items, total: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/unmapped-posts/resolve',
  authenticate,
  requirePermission('manage_1c_import'),
  validate(resolveUnmappedPostSchema),
  async (req, res) => {
    try {
      const { rawName, postId, isTracked } = req.body;
      // Находим/создаём запись unmapped
      let unmapped = await prisma.oneCUnmappedPost.findUnique({ where: { rawName } });
      if (!unmapped) {
        unmapped = await prisma.oneCUnmappedPost.create({ data: { rawName, occurrences: 0 } });
      }

      // Если postId задан — добавляем алиас в Post.externalAliases
      if (postId) {
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return res.status(404).json({ error: 'Post not found' });
        let aliases = [];
        try {
          aliases = post.externalAliases ? JSON.parse(post.externalAliases) : [];
          if (!Array.isArray(aliases)) aliases = [];
        } catch { aliases = []; }
        if (!aliases.includes(rawName)) aliases.push(rawName);
        const data = { externalAliases: JSON.stringify(aliases) };
        if (isTracked !== undefined) data.isTracked = !!isTracked;
        await prisma.post.update({ where: { id: postId } , data });
      }

      const resolved = await prisma.oneCUnmappedPost.update({
        where: { rawName },
        data: {
          resolvedPostId: postId || null,
          resolvedAsNonTracked: !postId && isTracked === false,
          resolvedBy: req.user?.email || req.user?.id || null,
          resolved: true,
          resolvedAt: new Date(),
        },
      });

      // Сбросим кэш резолвера, чтобы новый алиас подхватился
      const resolver = require('../services/postNameResolver');
      if (resolver.resetCache) resolver.resetCache();

      res.json(resolved);
    } catch (err) {
      logger.error('POST /oneC/unmapped-posts/resolve failed', { err: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
