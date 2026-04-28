#!/usr/bin/env node
/**
 * Bootstrap-миграция: переводит существующие Post/Zone/Camera в новую модель
 * (заполняет number, displayName, displayNameEn) и запускает первый sync
 * с активным MapLayout.
 *
 * Идемпотентный — можно запускать повторно.
 *
 * Использование:
 *   cd /project/backend && node scripts/migrateMapToEntities.js
 */

const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/database');
const { syncMapLayoutToEntities } = require('../src/services/mapSyncService');

// Правило типов постов на bootstrap (если в БД ещё не проставлено корректно).
function defaultPostType(num) {
  if (num >= 1 && num <= 4) return 'heavy';
  if (num === 9 || num === 10) return 'special';
  return 'light'; // 5-8, 11-...
}

// Парсит номер из имени "Пост 01" / "Пост 4 — легковое" → число.
function parsePostNumber(name) {
  if (!name) return null;
  const m = String(name).match(/(\d{1,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function loadI18n() {
  const ru = {};
  const en = {};
  try {
    const ruJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/src/i18n/ru.json'), 'utf8'));
    const enJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/src/i18n/en.json'), 'utf8'));
    Object.assign(ru, ruJson?.posts || {});
    Object.assign(en, enJson?.posts || {});
  } catch (e) {
    console.warn('[i18n] failed to load:', e.message);
  }
  return { ru, en };
}

async function backfillPostNumbers(i18n) {
  const posts = await prisma.post.findMany();
  let filled = 0;
  for (const p of posts) {
    const updates = {};
    if (p.number == null) {
      const n = parsePostNumber(p.name);
      if (n != null) updates.number = n;
    }
    const num = updates.number || p.number;
    if (num != null) {
      if (!p.displayName)   updates.displayName   = i18n.ru[`post${num}`] || p.name;
      if (!p.displayNameEn) updates.displayNameEn = i18n.en[`post${num}`] || `Post ${num}`;
      // Тип, если не задан или дефолтный — проставим по правилу
      if (!p.type || p.type === 'light') {
        const expected = defaultPostType(num);
        if (expected !== p.type) updates.type = expected;
      }
    }
    if (Object.keys(updates).length) {
      await prisma.post.update({ where: { id: p.id }, data: updates });
      filled++;
    }
  }
  return { posts: posts.length, updated: filled };
}

async function getActiveLayout() {
  const layout = await prisma.mapLayout.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  return layout;
}

async function run() {
  console.log('=== Map → Entities bootstrap migration ===\n');

  // 1. Backfill существующих Post (number, displayName, displayNameEn, type)
  console.log('[1/2] Backfilling existing Post rows…');
  const i18n = loadI18n();
  const backfill = await backfillPostNumbers(i18n);
  console.log(`     Processed: ${backfill.posts}, Updated: ${backfill.updated}`);

  // 2. Запускаем sync с активным layout (создаст недостающие, soft-delete лишних)
  console.log('\n[2/2] Running mapSyncService against active layout…');
  const layout = await getActiveLayout();
  if (!layout) {
    console.warn('     ⚠  No active map layout found — skipping sync.');
  } else {
    const summary = await syncMapLayoutToEntities(layout);
    console.log('     Done. Summary:');
    console.log(JSON.stringify(summary, null, 2));

    // Второй пас backfill — для свежесозданных через sync постов (заполнить displayNameEn из i18n)
    const afterFix = await backfillPostNumbers(i18n);
    console.log(`     Post-sync backfill: updated ${afterFix.updated}/${afterFix.posts}`);
  }

  console.log('\n=== Bootstrap complete ===\n');

  // Финальная сводка
  const total = {
    posts:   await prisma.post.count(),
    postsActive: await prisma.post.count({ where: { deleted: false } }),
    zones:   await prisma.zone.count(),
    zonesActive: await prisma.zone.count({ where: { deleted: false } }),
    cameras: await prisma.camera.count(),
    camerasActive: await prisma.camera.count({ where: { deleted: false } }),
  };
  console.log('DB state:');
  console.log(JSON.stringify(total, null, 2));
}

run()
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
