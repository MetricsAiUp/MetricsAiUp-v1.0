// IMAP-fetcher для писем с xlsx-вложениями от 1С (ParadAvto).
// Конфиг хранится в Imap1CConfig (одна строка, id=1). Пароль зашифрован AES-256-GCM.
//
// Поведение:
//   - На старте читает конфиг. Если enabled=false — loop не запускается.
//   - Cron каждые intervalMinutes.
//   - Каждый цикл:
//       1. SEARCH FROM ${fromFilter} SINCE (lastFetchAt - 1h)
//       2. Для каждого письма: создать OneCImport(status=pending), скачать вложения,
//          вызвать oneCImporter.process для каждого .xlsx.
//       3. Установить \Seen если markAsRead.
//       4. Если deleteAfterDays — удалить старые \Seen.
//   - Обновляет lastFetchAt, lastFetchStatus, lastFetchError.
//
// Регистрируется в src/index.js через start1CImapFetcher().

const cron = require('node-cron');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const prisma = require('../config/database');
const logger = require('../config/logger');
const { decrypt } = require('../utils/crypto');
const oneCImporter = require('./oneCImporter');

let task = null;
let running = false;

async function loadConfig() {
  const cfg = await prisma.imap1CConfig.findUnique({ where: { id: 1 } });
  return cfg;
}

async function getDecryptedPassword(cfg) {
  if (!cfg.passwordEncrypted) return null;
  try {
    return decrypt(cfg.passwordEncrypted);
  } catch (err) {
    logger.error('Failed to decrypt IMAP password', { err: err.message });
    return null;
  }
}

async function fetchOnce({ manual = false } = {}) {
  if (running) {
    logger.warn('IMAP 1C fetch already in progress, skipping');
    return { ok: false, reason: 'already_running' };
  }
  running = true;
  try {
    const cfg = await loadConfig();
    if (!cfg) return { ok: false, reason: 'no_config' };
    if (!cfg.enabled && !manual) return { ok: false, reason: 'disabled' };
    if (!cfg.user) return { ok: false, reason: 'no_user' };

    const password = await getDecryptedPassword(cfg);
    if (!password) {
      await prisma.imap1CConfig.update({
        where: { id: 1 },
        data: { lastFetchStatus: 'error', lastFetchError: 'cannot_decrypt_password', lastFetchAt: new Date() },
      });
      return { ok: false, reason: 'no_password' };
    }

    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.useSsl,
      auth: { user: cfg.user, pass: password },
      logger: false,
    });

    let processed = 0;
    let errors = 0;
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');

      const sinceDate = cfg.lastFetchAt
        ? new Date(cfg.lastFetchAt.getTime() - 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // первый запуск — 7 дней назад

      const searchCriteria = { from: cfg.fromFilter, since: sinceDate };
      const uids = await client.search(searchCriteria, { uid: true });

      logger.info('IMAP 1C: search results', { count: uids.length, since: sinceDate });

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
          if (!message) continue;

          const parsed = await simpleParser(message.source);
          const messageId = parsed.messageId || null;
          const fromAddress = (parsed.from?.value?.[0]?.address) || cfg.fromFilter;
          const subject = parsed.subject || null;
          const receivedAt = parsed.date || new Date();

          const attachments = (parsed.attachments || []).filter((a) =>
            a.filename && /\.xlsx$/i.test(a.filename) && a.content && a.content.length > 0
          );

          if (attachments.length === 0) {
            logger.info('IMAP 1C: no xlsx attachments in message', { uid, subject });
            continue;
          }

          for (const att of attachments) {
            // Проверка дедупа
            const exists = await prisma.oneCImport.findUnique({
              where: { uid_attachmentName: { uid: String(uid), attachmentName: att.filename } },
            });
            if (exists) {
              logger.info('IMAP 1C: import already exists, skipping', { uid, file: att.filename });
              continue;
            }

            const importRecord = await prisma.oneCImport.create({
              data: {
                uid: String(uid),
                messageId,
                fromAddress,
                subject,
                receivedAt,
                status: 'pending',
                source: 'imap',
                attachmentName: att.filename,
                attachmentSize: att.content.length,
              },
            });

            const result = await oneCImporter.process(importRecord, att.content);
            if (result.ok) processed++;
            else errors++;
          }

          if (cfg.markAsRead) {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          }
        } catch (err) {
          errors++;
          logger.error('IMAP 1C: failed to process message', { uid, err: err.message });
        }
      }

      // Удаление старых писем по deleteAfterDays
      if (cfg.deleteAfterDays && cfg.deleteAfterDays > 0) {
        const cutoff = new Date(Date.now() - cfg.deleteAfterDays * 24 * 60 * 60 * 1000);
        try {
          const oldUids = await client.search({ seen: true, before: cutoff, from: cfg.fromFilter }, { uid: true });
          if (oldUids.length > 0) {
            await client.messageDelete(oldUids, { uid: true });
            logger.info('IMAP 1C: deleted old messages', { count: oldUids.length });
          }
        } catch (err) {
          logger.warn('IMAP 1C: delete-old failed', { err: err.message });
        }
      }

    } finally {
      await client.logout().catch(() => {});
    }

    await prisma.imap1CConfig.update({
      where: { id: 1 },
      data: {
        lastFetchAt: new Date(),
        lastFetchStatus: errors > 0 ? 'partial' : 'ok',
        lastFetchError: null,
      },
    });

    logger.info('IMAP 1C: cycle finished', { processed, errors });
    return { ok: true, processed, errors };

  } catch (err) {
    logger.error('IMAP 1C: fetch failed', { err: err.message, stack: err.stack });
    await prisma.imap1CConfig.update({
      where: { id: 1 },
      data: { lastFetchAt: new Date(), lastFetchStatus: 'error', lastFetchError: err.message?.slice(0, 500) },
    }).catch(() => {});
    return { ok: false, reason: 'error', error: err.message };
  } finally {
    running = false;
  }
}

async function testConnection({ host, port, useSsl, user, password }) {
  const client = new ImapFlow({ host, port, secure: useSsl, auth: { user, pass: password }, logger: false });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    const status = await client.status('INBOX', { messages: true });
    await client.logout();
    return { ok: true, messages: status.messages };
  } catch (err) {
    try { await client.logout(); } catch { /* */ }
    return { ok: false, error: err.message };
  }
}

async function start() {
  const cfg = await loadConfig();
  if (!cfg) {
    // Создаём дефолтную пустую запись чтобы UI имел что показывать
    await prisma.imap1CConfig.create({ data: { id: 1 } }).catch(() => {});
    logger.info('IMAP 1C: default config created (disabled)');
    return;
  }
  if (!cfg.enabled) {
    logger.info('IMAP 1C: fetcher disabled by config');
    return;
  }
  scheduleCron(cfg.intervalMinutes);
}

function scheduleCron(intervalMinutes) {
  if (task) {
    task.stop();
    task = null;
  }
  const safe = Math.max(5, Math.min(1440, intervalMinutes || 30));
  // node-cron supports `*/N` only when N divides 60 cleanly for minutes. Для произвольных интервалов используем простой timer.
  if (safe < 60 && (60 % safe === 0)) {
    const expr = `*/${safe} * * * *`;
    task = cron.schedule(expr, () => fetchOnce().catch(() => {}));
    logger.info('IMAP 1C: cron scheduled', { expr });
  } else {
    // fallback: setInterval
    const ms = safe * 60 * 1000;
    const handle = setInterval(() => fetchOnce().catch(() => {}), ms);
    task = { stop: () => clearInterval(handle) };
    logger.info('IMAP 1C: interval scheduled', { minutes: safe });
  }
}

async function reschedule() {
  const cfg = await loadConfig();
  if (task) { task.stop(); task = null; }
  if (cfg && cfg.enabled) scheduleCron(cfg.intervalMinutes);
}

function stop() {
  if (task) { task.stop(); task = null; }
}

module.exports = {
  start,
  stop,
  reschedule,
  fetchOnce,
  testConnection,
};
