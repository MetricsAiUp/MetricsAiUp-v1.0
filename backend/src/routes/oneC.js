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
// Поля host/port/useSsl/user/password — опциональны: если не переданы,
// подставим из сохранённого Imap1CConfig (включая расшифрованный пароль).
router.post(
  '/config/test',
  authenticate,
  requirePermission('manage_1c_config'),
  validate(testConnectionSchema),
  async (req, res) => {
    try {
      const { decrypt } = require('../utils/crypto');
      const cfg = await prisma.imap1CConfig.findUnique({ where: { id: 1 } });
      const merged = {
        host: req.body.host || cfg?.host,
        port: req.body.port || cfg?.port,
        useSsl: req.body.useSsl === undefined ? !!cfg?.useSsl : !!req.body.useSsl,
        user: req.body.user || cfg?.user,
        password: req.body.password,
      };
      if (!merged.password) {
        if (!cfg?.passwordEncrypted) {
          return res.json({ ok: false, error: 'Пароль не задан и не сохранён' });
        }
        try { merged.password = decrypt(cfg.passwordEncrypted); }
        catch (e) { return res.json({ ok: false, error: 'Не удалось расшифровать сохранённый пароль: ' + e.message }); }
      }
      if (!merged.host || !merged.port || !merged.user) {
        return res.json({ ok: false, error: 'Не заполнены host/port/user (ни в форме, ни в сохранённой конфигурации)' });
      }
      const result = await imap1cFetcher.testConnection(merged);
      res.json(result);
    } catch (err) {
      logger.error('POST /oneC/config/test failed', { err: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// /imports -------------------------------------------------------------------

// GET /api/oneC/imports?status=...&take=&skip=&from=&to=
router.get('/imports', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.detectedType) where.detectedType = String(req.query.detectedType);
    if (req.query.from || req.query.to) {
      where.receivedAt = {};
      if (req.query.from) where.receivedAt.gte = new Date(String(req.query.from));
      if (req.query.to) where.receivedAt.lte = new Date(String(req.query.to));
    }
    if (req.query.q) {
      const q = String(req.query.q);
      where.OR = [
        { subject:        { contains: q } },
        { fromAddress:    { contains: q } },
        { attachmentName: { contains: q } },
      ];
    }
    // Фильтр для бейджа на табе: только не-квитированные ошибки.
    if (req.query.acknowledged === 'false') where.acknowledgedAt = null;
    if (req.query.acknowledged === 'true')  where.acknowledgedAt = { not: null };

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
          acknowledgedAt: true, acknowledgedBy: true,
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

// POST /api/oneC/imports/:id/acknowledge — пометить ошибочный импорт как «прочитанный».
// Разрешено только для записей с status, начинающимся на 'error'.
router.post('/imports/:id/acknowledge', authenticate, requirePermission('manage_1c_import'), async (req, res) => {
  try {
    const imp = await prisma.oneCImport.findUnique({ where: { id: req.params.id } });
    if (!imp) return res.status(404).json({ error: 'Import not found' });
    if (!String(imp.status || '').startsWith('error')) {
      return res.status(400).json({ error: 'Acknowledge is allowed only for error imports' });
    }
    const updated = await prisma.oneCImport.update({
      where: { id: imp.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user?.email || req.user?.id || 'unknown',
      },
    });
    res.json(updated);
  } catch (err) {
    logger.error('POST /oneC/imports/:id/acknowledge failed', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oneC/imports/:id/unacknowledge — снять отметку.
router.post('/imports/:id/unacknowledge', authenticate, requirePermission('manage_1c_import'), async (req, res) => {
  try {
    const imp = await prisma.oneCImport.findUnique({ where: { id: req.params.id } });
    if (!imp) return res.status(404).json({ error: 'Import not found' });
    const updated = await prisma.oneCImport.update({
      where: { id: imp.id },
      data: { acknowledgedAt: null, acknowledgedBy: null },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /current -------------------------------------------------------------------

// GET /api/oneC/current?take=&skip=&state=&plate=&search=
router.get('/current', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const take = parseInteger(req.query.take, 100, 50000);
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
//
// Дедуп полностью идентичных строк: 1С присылает snapshot-выгрузки повторно,
// поэтому в raw-таблицах накапливаются записи с одинаковым набором отображаемых
// в UI полей. На уровне выдачи схлопываем их в одну (самая свежая по received_at)
// через ROW_NUMBER() OVER (PARTITION BY <набор UI-колонок>).
//
// Набор UI-колонок жёстко синхронизирован с frontend/src/pages/Data1C.jsx
// (константа RAW_COLUMNS). Любые поля, не отображаемые в UI (importId, receivedAt,
// contentHash и т.д.), в partition НЕ входят.

// snake_case → camelCase (имена столбцов из $queryRawUnsafe).
function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'rn') continue;
    const ck = snakeToCamel(k);
    out[ck] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

const RAW_META = {
  plan: {
    table: 'one_c_plan_rows',
    orderCol: 'received_at',
    // Колонки UI «Планы и Заявки» (RAW_COLUMNS.plan): documentText, organization,
    // vehicle (= vehicleText/plateNumber/vin), number, scheduledStart, scheduledEnd,
    // durationSec, note (= isOutdated).
    dedupCols: [
      'document_text', 'organization',
      'vehicle_text', 'plate_number', 'vin',
      'number',
      'scheduled_start', 'scheduled_end',
      'duration_sec', 'is_outdated',
    ],
    searchCols: ['number', 'vehicle_text', 'plate_number', 'vin', 'post_raw_name'],
    orderNumberCol: 'number',
  },
  repair: {
    table: 'one_c_repair_snapshots',
    orderCol: 'work_started_at',
    // Колонки UI «Заказ-наряды» (RAW_COLUMNS.repair): vehicle (= vehicleText/brand/
    // model/plateNumber1/plateNumber2/vin), orderNumber, state, repairKind,
    // workStartedAt, workFinishedAt, closedAt, basis, basisStart, basisEnd, master,
    // dispatcher.
    dedupCols: [
      'vehicle_text', 'brand', 'model', 'plate_number_1', 'plate_number_2', 'vin',
      'order_number', 'state', 'repair_kind',
      'work_started_at', 'work_finished_at', 'closed_at',
      'basis', 'basis_start', 'basis_end',
      'master', 'dispatcher',
    ],
    searchCols: ['order_number', 'vehicle_text', 'brand', 'model', 'plate_number_1', 'plate_number_2', 'vin', 'master', 'dispatcher', 'repair_kind', 'state'],
    orderNumberCol: 'order_number',
  },
  performed: {
    table: 'one_c_work_performed',
    orderCol: 'closed_at',
    // Колонки UI «Закрытые ЗН» (RAW_COLUMNS.performed): vehicle (= vehicleText/brand/
    // model/plateNumber/vin), orderNumber, repairKind, state, workStartedAt,
    // workFinishedAt, closedAt, master, dispatcher, executor, causeDescription,
    // normHours.
    dedupCols: [
      'vehicle_text', 'brand', 'model', 'plate_number', 'vin',
      'order_number', 'repair_kind', 'state',
      'work_started_at', 'work_finished_at', 'closed_at',
      'master', 'dispatcher', 'executor',
      'cause_description', 'norm_hours',
    ],
    searchCols: ['order_number', 'vehicle_text', 'brand', 'model', 'plate_number', 'vin', 'executor', 'master', 'dispatcher', 'repair_kind', 'state', 'cause_description'],
    orderNumberCol: 'order_number',
  },
};

router.get('/raw/:type', authenticate, requirePermission('view_1c'), async (req, res) => {
  try {
    const meta = RAW_META[req.params.type];
    if (!meta) return res.status(400).json({ error: 'type must be plan|repair|performed' });
    const take = parseInteger(req.query.take, 50, 500);
    const skip = parseInteger(req.query.skip, 0, 100000);

    // Собираем WHERE (фильтры применяются ДО дедупа — это корректно, потому что
    // фильтрующие поля сами входят в дедуп-ключ либо являются техническими).
    const conditions = [];
    const params = [];
    // Вкладка «Планы и Заявки»: только строки с document_type ∈ {План ремонта, Заявка на ремонт}.
    if (req.params.type === 'plan') {
      conditions.push(`document_type IN ('План ремонта', 'Заявка на ремонт')`);
    }
    if (req.query.orderNumber) {
      conditions.push(`${meta.orderNumberCol} = ?`);
      params.push(String(req.query.orderNumber));
    }
    if (req.query.importId) {
      conditions.push(`import_id = ?`);
      params.push(String(req.query.importId));
    }
    if (req.query.from) {
      conditions.push(`received_at >= ?`);
      params.push(new Date(String(req.query.from)).toISOString());
    }
    if (req.query.to) {
      conditions.push(`received_at <= ?`);
      params.push(new Date(String(req.query.to)).toISOString());
    }
    if (req.query.q) {
      const q = String(req.query.q);
      const orParts = meta.searchCols.map((c) => `${c} LIKE ?`);
      conditions.push(`(${orParts.join(' OR ')})`);
      meta.searchCols.forEach(() => params.push(`%${q}%`));
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // COALESCE(..., '') в PARTITION BY — иначе NULL'ы трактуются как разные значения
    // и две идентичные строки с NULL в одном из полей не схлопываются.
    const partitionExpr = meta.dedupCols.map((c) => `COALESCE(${c}, '')`).join(', ');

    const itemsSql = `
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY ${partitionExpr}
          ORDER BY received_at DESC
        ) AS rn
        FROM ${meta.table}
        ${whereSql}
      ) WHERE rn = 1
      ORDER BY ${meta.orderCol} DESC
      LIMIT ${take} OFFSET ${skip}
    `;
    const totalSql = `
      SELECT COUNT(*) AS c FROM (
        SELECT 1 FROM ${meta.table}
        ${whereSql}
        GROUP BY ${partitionExpr}
      )
    `;

    const rowsRaw = await prisma.$queryRawUnsafe(itemsSql, ...params);
    const totalRows = await prisma.$queryRawUnsafe(totalSql, ...params);

    const items = rowsRaw.map(camelizeRow);
    const total = Number(totalRows[0]?.c ?? 0);

    res.json({ items, total, take, skip });
  } catch (err) {
    logger.error('GET /oneC/raw failed', { err: err.message });
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

      // Сообщим фронту, что бейдж «Несопоставленные» надо перечитать.
      try {
        const io = req.app.get('io');
        if (io) io.emit('unmapped:changed', { autoResolved: 0, manualResolved: 1, at: new Date().toISOString() });
      } catch { /* ignore */ }

      res.json(resolved);
    } catch (err) {
      logger.error('POST /oneC/unmapped-posts/resolve failed', { err: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
