// Перепроверка таблицы OneCUnmappedPost.
//
// Зачем:
//   1. Записи в OneCUnmappedPost попадают только при импорте письма
//      (oneCImporter → postNameResolver.resolve). Если админ позже добавил
//      alias к Post.externalAliases или создал Post с подходящим номером,
//      старые записи resolved=false висят «зависшими» — никто их не
//      пере-проверяет.
//   2. detectAll нестыковок умалчивает unmapped, поэтому счётчик «Несопоставленные»
//      не двигается между импортами писем.
//
// Что делает rescan():
//   1. Сбрасывает кэш resolver'а (поднять свежие aliases/posts).
//   2. Для каждой OneCUnmappedPost.resolved=false — повторно вызывает
//      postNameResolver.resolve(rawName). Если теперь резолвится
//      через regex/alias — помечает запись resolved=true с
//      resolvedBy='auto'.
//   3. Дополнительно проходит по distinct postRawName из OneCPlanRow
//      и OneCStageMerged — на случай, если где-то импорт пропустил вызов
//      резолвера (или модель добавили позже). Новые rawName попадут в
//      OneCUnmappedPost через resolve().
//   4. Если что-то изменилось — io.emit('unmapped:changed') для фронта.
//
// Возвращает: { scanned, autoResolved, newUnmapped }.

const prisma = require('../config/database');
const logger = require('../config/logger');
const postNameResolver = require('./postNameResolver');

function getIO() {
  try { return require('../config/socket').getIO(); }
  catch { return null; }
}

async function collectRawNames() {
  // Берём все известные сырые имена постов из raw-таблиц + текущих unmapped.
  const set = new Set();
  const planRows = await prisma.oneCPlanRow.findMany({
    select: { postRawName: true },
    distinct: ['postRawName'],
  });
  for (const r of planRows) if (r.postRawName) set.add(r.postRawName.trim());

  const stageRows = await prisma.oneCStageMerged.findMany({
    select: { postRawName: true },
    distinct: ['postRawName'],
  });
  for (const r of stageRows) if (r.postRawName) set.add(r.postRawName.trim());

  return [...set];
}

async function rescan({ trigger = 'cron' } = {}) {
  const t0 = Date.now();
  // 1. Свежий кэш — после ручных правок aliases / новых Post.
  if (postNameResolver.resetCache) postNameResolver.resetCache();

  let scanned = 0;
  let autoResolved = 0;
  let newUnmapped = 0;

  // 2. Авто-резолюция «зависших» записей.
  const stuck = await prisma.oneCUnmappedPost.findMany({
    where: { resolved: false },
    select: { rawName: true },
  });
  for (const u of stuck) {
    scanned++;
    const r = await postNameResolver.resolve(u.rawName);
    // resolve() вернёт source='regex' | 'alias' | 'manual' | 'unmapped'
    if (r && r.postId && (r.source === 'regex' || r.source === 'alias')) {
      await prisma.oneCUnmappedPost.update({
        where: { rawName: u.rawName },
        data: {
          resolved: true,
          resolvedPostId: r.postId,
          resolvedAsNonTracked: false,
          resolvedBy: `auto:${r.source}`,
          resolvedAt: new Date(),
        },
      });
      autoResolved++;
    }
  }

  // 3. Подбор пропущенных rawName из raw-таблиц (на случай если импорт не вызвал резолвер).
  let beforeCount = 0;
  try { beforeCount = await prisma.oneCUnmappedPost.count(); } catch { /* */ }
  const allRawNames = await collectRawNames();
  for (const rn of allRawNames) {
    scanned++;
    // resolve() сама upsert-ит в OneCUnmappedPost, если не резолвится.
    await postNameResolver.resolve(rn);
  }
  let afterCount = 0;
  try { afterCount = await prisma.oneCUnmappedPost.count(); } catch { /* */ }
  newUnmapped = Math.max(0, afterCount - beforeCount);

  const durationMs = Date.now() - t0;
  const changed = autoResolved > 0 || newUnmapped > 0;
  logger.info('unmappedPostsRescanner.rescan done', { trigger, scanned, autoResolved, newUnmapped, durationMs });

  if (changed) {
    const io = getIO();
    if (io) {
      try { io.emit('unmapped:changed', { autoResolved, newUnmapped, at: new Date().toISOString() }); }
      catch (err) { logger.warn('unmapped:changed emit failed', { err: err.message }); }
    }
  }

  return { scanned, autoResolved, newUnmapped, durationMs };
}

module.exports = { rescan };
