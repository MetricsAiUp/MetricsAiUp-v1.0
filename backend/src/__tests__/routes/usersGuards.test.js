import { describe, it, expect } from 'vitest';

// Воспроизводит helpers из routes/users.js — чистая логика, без БД.

const AVAILABLE_PAGE_IDS = new Set([
  'dashboard', 'dashboard-posts', 'posts-detail', 'sessions', 'work-orders',
  'shifts', 'events', 'analytics', 'cameras', 'data-1c', 'discrepancies',
  'users', 'map-view', 'map-editor', 'audit', 'health', 'my-post',
  'report-schedule', 'tech-docs', 'live-debug', 'utilization',
]);

function sanitizePages(pages) {
  if (!Array.isArray(pages)) return [];
  return [...new Set(pages.filter((p) => typeof p === 'string' && AVAILABLE_PAGE_IDS.has(p)))];
}

function userHasRole(user, roleName) {
  return user.roles.some((ur) => ur.role.name === roleName);
}

describe('users.js — sanitizePages', () => {
  it('пропускает только валидные pageId', () => {
    const result = sanitizePages(['dashboard', 'map', 'analytics']);
    expect(result).toEqual(['dashboard', 'analytics']);
  });

  it('убирает мусорный "map" (наследие старой версии)', () => {
    const result = sanitizePages(['dashboard-posts', 'map', 'map-view']);
    expect(result).toEqual(['dashboard-posts', 'map-view']);
  });

  it('удаляет дубли', () => {
    const result = sanitizePages(['dashboard', 'dashboard', 'sessions']);
    expect(result).toEqual(['dashboard', 'sessions']);
  });

  it('возвращает пустой массив при невалидном входе', () => {
    expect(sanitizePages(null)).toEqual([]);
    expect(sanitizePages(undefined)).toEqual([]);
    expect(sanitizePages('not-array')).toEqual([]);
    expect(sanitizePages([null, 123, false])).toEqual([]);
  });

  it('utilization — теперь валидная страница', () => {
    expect(sanitizePages(['utilization'])).toEqual(['utilization']);
  });
});

describe('users.js — last admin protection', () => {
  // Модель: { isActive, roles: [{ role: { name } }] }
  const mkUser = (active, ...roles) => ({
    isActive: active,
    roles: roles.map((name) => ({ role: { name } })),
  });

  it('userHasRole возвращает true когда роль присутствует', () => {
    const u = mkUser(true, 'admin', 'manager');
    expect(userHasRole(u, 'admin')).toBe(true);
    expect(userHasRole(u, 'viewer')).toBe(false);
  });

  it('запрещает деактивацию когда был единственным активным admin', () => {
    const existing = mkUser(true, 'admin');
    const nextIsActive = false;
    const nextRoleNames = ['admin'];
    const activeAdminsCount = 1; // в системе только этот admin

    const wasActiveAdmin = existing.isActive && userHasRole(existing, 'admin');
    const willBeActiveAdmin = nextIsActive && nextRoleNames.includes('admin');
    const shouldBlock = wasActiveAdmin && !willBeActiveAdmin && activeAdminsCount <= 1;
    expect(shouldBlock).toBe(true);
  });

  it('разрешает деактивацию admin когда есть ещё один активный admin', () => {
    const existing = mkUser(true, 'admin');
    const nextIsActive = false;
    const nextRoleNames = ['admin'];
    const activeAdminsCount = 2; // ещё один admin есть

    const wasActiveAdmin = existing.isActive && userHasRole(existing, 'admin');
    const willBeActiveAdmin = nextIsActive && nextRoleNames.includes('admin');
    const shouldBlock = wasActiveAdmin && !willBeActiveAdmin && activeAdminsCount <= 1;
    expect(shouldBlock).toBe(false);
  });

  it('запрещает смену роли admin → viewer для последнего admin', () => {
    const existing = mkUser(true, 'admin');
    const nextIsActive = true;
    const nextRoleNames = ['viewer']; // смена роли
    const activeAdminsCount = 1;

    const wasActiveAdmin = existing.isActive && userHasRole(existing, 'admin');
    const willBeActiveAdmin = nextIsActive && nextRoleNames.includes('admin');
    const shouldBlock = wasActiveAdmin && !willBeActiveAdmin && activeAdminsCount <= 1;
    expect(shouldBlock).toBe(true);
  });

  it('не блокирует редактирование admin когда роль admin сохраняется', () => {
    const existing = mkUser(true, 'admin');
    const nextIsActive = true;
    const nextRoleNames = ['admin']; // без изменений
    const activeAdminsCount = 1;

    const wasActiveAdmin = existing.isActive && userHasRole(existing, 'admin');
    const willBeActiveAdmin = nextIsActive && nextRoleNames.includes('admin');
    const shouldBlock = wasActiveAdmin && !willBeActiveAdmin && activeAdminsCount <= 1;
    expect(shouldBlock).toBe(false);
  });

  it('не блокирует деактивацию не-admin пользователя', () => {
    const existing = mkUser(true, 'manager');
    const nextIsActive = false;
    const nextRoleNames = ['manager'];

    const wasActiveAdmin = existing.isActive && userHasRole(existing, 'admin');
    // последний admin invariant не применяется
    expect(wasActiveAdmin).toBe(false);
  });

  it('самостоятельная деактивация — отдельный 400 регардлесс admin-инварианта', () => {
    const currentUserId = 'u-self';
    const targetId = 'u-self';
    const requestedIsActive = false;
    const shouldBlockSelf = requestedIsActive === false && targetId === currentUserId;
    expect(shouldBlockSelf).toBe(true);
  });
});

describe('rolePages — frontend mirror sync', () => {
  it('содержимое backend и frontend ROLE_PAGES должно совпадать', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath, pathToFileURL } = await import('node:url');

    const here = path.dirname(fileURLToPath(import.meta.url));
    const bePath = path.resolve(here, '../../config/rolePages.js');
    const fePath = path.resolve(here, '../../../../frontend/src/constants/rolePages.js');

    expect(fs.existsSync(bePath)).toBe(true);
    expect(fs.existsSync(fePath)).toBe(true);

    const backend = await import(pathToFileURL(bePath).href);
    const frontend = await import(pathToFileURL(fePath).href);

    expect(frontend.ROLE_PAGES).toBeDefined();
    expect(backend.ROLE_PAGES).toBeDefined();

    const beKeys = Object.keys(backend.ROLE_PAGES).sort();
    const feKeys = Object.keys(frontend.ROLE_PAGES).sort();
    expect(feKeys).toEqual(beKeys);

    for (const role of beKeys) {
      expect(frontend.ROLE_PAGES[role]).toEqual(backend.ROLE_PAGES[role]);
    }
  });
});
