// Резолвит сырое имя поста из 1С (например "ПОСТ 1 Кол(2-х ст >2,5т)")
// в Post.id текущей БД.
// Каскад:
//   1. Regex /^\s*(?:ПОСТ|Пост|Post)\s*(\d{1,2})\b/ → ищем Post.number
//   2. Post.externalAliases (JSON-массив) — точное совпадение rawName
//   3. Если уже отрезолвлен через OneCUnmappedPost (resolved=true) — берём оттуда
//   4. Иначе — записываем в OneCUnmappedPost (upsert + occurrences++) и возвращаем null
//
// Возвращает: { postId: string|null, isTracked: boolean, source: 'regex'|'alias'|'unmapped'|'manual' }

const prisma = require('../config/database');

const POST_REGEX = /^\s*(?:ПОСТ|Пост|Post)\s*(\d{1,2})\b/u;

// Кэш живёт пока процесс не перезапущен. На правки aliases/unmapped — invalidate через resetCache().
let aliasCache = null;
let numberCache = null;
let resolvedUnmappedCache = null;

async function loadCaches() {
  const posts = await prisma.post.findMany({
    where: { deleted: false },
    select: { id: true, number: true, externalAliases: true, isTracked: true },
  });

  numberCache = new Map();
  aliasCache = new Map();
  for (const p of posts) {
    if (p.number != null) numberCache.set(p.number, p);
    if (p.externalAliases) {
      try {
        const arr = JSON.parse(p.externalAliases);
        if (Array.isArray(arr)) {
          for (const a of arr) {
            if (typeof a === 'string') aliasCache.set(a.trim(), p);
          }
        }
      } catch { /* ignore malformed JSON */ }
    }
  }

  const unmapped = await prisma.oneCUnmappedPost.findMany({ where: { resolved: true } });
  resolvedUnmappedCache = new Map();
  for (const u of unmapped) resolvedUnmappedCache.set(u.rawName, u);
}

function resetCache() {
  aliasCache = null;
  numberCache = null;
  resolvedUnmappedCache = null;
}

async function ensureCache() {
  if (!numberCache || !aliasCache || !resolvedUnmappedCache) await loadCaches();
}

async function resolve(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return { postId: null, isTracked: true, source: 'invalid' };
  }
  const trimmed = rawName.trim();
  await ensureCache();

  // 1. Regex
  const m = trimmed.match(POST_REGEX);
  if (m) {
    const num = parseInt(m[1], 10);
    const post = numberCache.get(num);
    if (post) return { postId: post.id, isTracked: post.isTracked, source: 'regex' };
  }

  // 2. Aliases
  const alias = aliasCache.get(trimmed);
  if (alias) return { postId: alias.id, isTracked: alias.isTracked, source: 'alias' };

  // 3. Уже разрешено вручную через OneCUnmappedPost
  const manual = resolvedUnmappedCache.get(trimmed);
  if (manual) {
    if (manual.resolvedAsNonTracked) return { postId: null, isTracked: false, source: 'manual' };
    if (manual.resolvedPostId) {
      // verify post still exists; if not — fall through to unmapped
      const post = await prisma.post.findUnique({ where: { id: manual.resolvedPostId }, select: { id: true, isTracked: true } });
      if (post) return { postId: post.id, isTracked: post.isTracked, source: 'manual' };
    }
  }

  // 4. Пишем в OneCUnmappedPost (upsert + увеличить occurrences)
  await prisma.oneCUnmappedPost.upsert({
    where: { rawName: trimmed },
    update: {
      occurrences: { increment: 1 },
      lastSeenAt: new Date(),
    },
    create: {
      rawName: trimmed,
      occurrences: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  return { postId: null, isTracked: true, source: 'unmapped' };
}

module.exports = { resolve, resetCache, POST_REGEX };
