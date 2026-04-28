/**
 * mapSyncService — приводит таблицы Post / Zone / Camera в соответствие
 * с активным MapLayout. Вызывается на сохранении карты в редакторе.
 *
 * Принцип:
 *   - layout — единственный источник истины.
 *   - Что в карте — то upsert в БД.
 *   - Что НЕ в карте, но в БД — soft-delete (deleted=true), чтобы FK
 *     на Event/Session/ZoneStay/PostStay не сломались.
 *
 * Идентификация:
 *   - Post   ←→ element.id (число "1".."N") → Post.number
 *   - Zone   ←→ element.name
 *   - Camera ←→ element.name
 */

const prisma = require('../config/database');
const logger = require('../config/logger');

/** Парсит elements (может быть строкой JSON или массивом). */
function parseElements(layout) {
  if (!layout) return [];
  const raw = layout.elements;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

/**
 * Извлекает номер поста из элемента.
 * Приоритет: el.number → разбор el.name ("Пост 04" → 4) → разбор el.id ("11" → 11).
 */
function getPostNumber(el) {
  if (!el || el.type !== 'post') return null;
  if (Number.isFinite(el.number) && el.number > 0) return el.number;
  if (el.name) {
    const m = String(el.name).match(/(\d{1,3})/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  if (el.id != null) {
    const n = parseInt(el.id, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Убирает undefined из объекта — чтобы Prisma update не затирал
 * существующие значения отсутствующими полями.
 */
function compact(data) {
  const out = {};
  for (const k of Object.keys(data)) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

async function syncPosts(elements) {
  const postsInMap = elements.filter(e => e.type === 'post');
  const numbersInMap = [];
  const seenNumbers = new Set();
  const stats = { created: 0, updated: 0, softDeleted: 0, restored: 0 };

  // fallback-зона для новых постов (когда зон в карте нет или ещё не создана)
  let fallbackZone = null;
  const ensureFallbackZone = async () => {
    if (fallbackZone) return fallbackZone;
    fallbackZone = await prisma.zone.findFirst({ where: { deleted: false }, orderBy: { createdAt: 'asc' } });
    if (!fallbackZone) {
      fallbackZone = await prisma.zone.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    return fallbackZone;
  };

  for (const el of postsInMap) {
    const number = getPostNumber(el);
    if (!number) continue;
    if (seenNumbers.has(number)) continue;     // дедуп: несколько элементов с одним номером
    seenNumbers.add(number);
    numbersInMap.push(number);

    // displayName в layout берём в порядке: el.label (после Шага 7) → el.name (текущая карта)
    const labelFromLayout = el.label || el.name;

    const updateFields = compact({
      type:             el.postType,
      displayName:      labelFromLayout,
      displayNameEn:    el.labelEn,
      externalZoneName: el.externalZoneName,
      externalAliases:  el.externalAliases ? JSON.stringify(el.externalAliases) : undefined,
    });

    const existing = await prisma.post.findUnique({ where: { number } });
    if (existing) {
      const wasDeleted = existing.deleted;
      await prisma.post.update({
        where: { number },
        data: { ...updateFields, deleted: false, deletedAt: null },
      });
      if (wasDeleted) stats.restored++;
      else stats.updated++;
    } else {
      const zone = await ensureFallbackZone();
      if (!zone) {
        logger.warn('mapSync: cannot create post — no zones in DB', { number });
        continue;
      }
      await prisma.post.create({
        data: {
          zoneId: zone.id,
          name: labelFromLayout || `Пост ${String(number).padStart(2, '0')}`,
          number,
          type: el.postType || 'light',
          status: 'free',
          displayName: labelFromLayout || null,
          displayNameEn: el.labelEn || null,
          externalZoneName: el.externalZoneName || null,
          externalAliases: el.externalAliases ? JSON.stringify(el.externalAliases) : null,
        },
      });
      stats.created++;
    }
  }

  // soft-delete постов, которых больше нет в карте (только те, у кого проставлен number)
  const soft = await prisma.post.updateMany({
    where: {
      number: { not: null, notIn: numbersInMap },
      deleted: false,
    },
    data: { deleted: true, deletedAt: new Date() },
  });
  stats.softDeleted = soft.count;

  return stats;
}

async function syncZones(elements) {
  const zonesInMap = elements.filter(e => e.type === 'zone');
  const namesInMap = [];
  const stats = { created: 0, updated: 0, softDeleted: 0, restored: 0 };

  for (const el of zonesInMap) {
    const name = el.name;
    if (!name) continue;
    namesInMap.push(name);

    const updateFields = compact({
      type:          el.zoneType,
      displayName:   el.label,
      displayNameEn: el.labelEn,
    });

    const existing = await prisma.zone.findFirst({ where: { name } });
    if (existing) {
      const wasDeleted = existing.deleted;
      await prisma.zone.update({
        where: { id: existing.id },
        data: { ...updateFields, deleted: false, deletedAt: null },
      });
      if (wasDeleted) stats.restored++;
      else stats.updated++;
    } else {
      await prisma.zone.create({
        data: {
          name,
          type: el.zoneType || 'repair',
          displayName: el.label || null,
          displayNameEn: el.labelEn || null,
        },
      });
      stats.created++;
    }
  }

  const soft = await prisma.zone.updateMany({
    where: { name: { notIn: namesInMap }, deleted: false },
    data: { deleted: true, deletedAt: new Date() },
  });
  stats.softDeleted = soft.count;

  return stats;
}

async function syncCameras(elements) {
  const camerasInMap = elements.filter(e => e.type === 'camera');
  const namesInMap = [];
  const stats = { created: 0, updated: 0, softDeleted: 0, restored: 0 };

  for (const el of camerasInMap) {
    const name = el.name;
    if (!name) continue;
    namesInMap.push(name);

    const existing = await prisma.camera.findFirst({ where: { name } });
    if (existing) {
      const wasDeleted = existing.deleted;
      await prisma.camera.update({
        where: { id: existing.id },
        data: {
          deleted: false,
          deletedAt: null,
          ...(el.rtspUrl ? { rtspUrl: el.rtspUrl } : {}),
        },
      });
      if (wasDeleted) stats.restored++;
      else stats.updated++;
    } else {
      await prisma.camera.create({
        data: {
          name,
          rtspUrl: el.rtspUrl || el.data?.rtspUrl || '',
        },
      });
      stats.created++;
    }
  }

  const soft = await prisma.camera.updateMany({
    where: { name: { notIn: namesInMap }, deleted: false },
    data: { deleted: true, deletedAt: new Date() },
  });
  stats.softDeleted = soft.count;

  return stats;
}

/**
 * Главная функция — приводит БД в соответствие с layout.
 * Порядок: zones → posts (зависят от zone FK) → cameras.
 */
async function syncMapLayoutToEntities(layout) {
  const elements = parseElements(layout);

  const zones = await syncZones(elements);
  const posts = await syncPosts(elements);
  const cameras = await syncCameras(elements);

  const summary = { zones, posts, cameras };
  logger.info('Map sync complete', summary);

  // Best-effort emit (в скриптах/тестах сокета может не быть)
  try {
    const { getIO } = require('../config/socket');
    getIO().emit('map:synced', summary);
  } catch (_) { /* ignore */ }

  return summary;
}

module.exports = {
  syncMapLayoutToEntities,
  parseElements,
  getPostNumber,
  // экспорт для тестов
  _internal: { syncPosts, syncZones, syncCameras },
};
