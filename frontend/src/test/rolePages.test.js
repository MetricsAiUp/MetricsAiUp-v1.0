import { describe, it, expect } from 'vitest';
import { ROLE_PAGES, pagesForRole } from '../constants/rolePages.js';

describe('frontend rolePages constants', () => {
  it('содержит все 5 ролей', () => {
    expect(Object.keys(ROLE_PAGES).sort()).toEqual(['admin', 'director', 'manager', 'mechanic', 'viewer']);
  });

  it('admin имеет все ключевые страницы включая utilization', () => {
    const p = ROLE_PAGES.admin;
    expect(p).toContain('users');
    expect(p).toContain('audit');
    expect(p).toContain('health');
    expect(p).toContain('map-editor');
    expect(p).toContain('utilization');
    expect(p).toContain('live-debug');
  });

  it('viewer ограничен 3 страницами', () => {
    expect(ROLE_PAGES.viewer).toEqual(['dashboard', 'dashboard-posts', 'map-view']);
  });

  it('manager не имеет users/audit/health', () => {
    const p = ROLE_PAGES.manager;
    expect(p).not.toContain('users');
    expect(p).not.toContain('audit');
    expect(p).not.toContain('health');
    expect(p).toContain('work-orders');
    expect(p).toContain('data-1c');
  });

  it('director имеет аналитику и камеры, но не управление пользователями', () => {
    const p = ROLE_PAGES.director;
    expect(p).toContain('analytics');
    expect(p).toContain('cameras');
    expect(p).not.toContain('users');
    expect(p).not.toContain('map-editor');
  });

  it('mechanic — только базовый набор + my-post', () => {
    expect(ROLE_PAGES.mechanic).toContain('my-post');
    expect(ROLE_PAGES.mechanic).toContain('sessions');
    expect(ROLE_PAGES.mechanic).not.toContain('analytics');
  });

  it('pagesForRole возвращает viewer-набор для неизвестной роли', () => {
    expect(pagesForRole('unknown-role')).toEqual(ROLE_PAGES.viewer);
    expect(pagesForRole(undefined)).toEqual(ROLE_PAGES.viewer);
  });

  it('ни одна роль не содержит мусорный pageId "map"', () => {
    for (const role of Object.values(ROLE_PAGES)) {
      expect(role).not.toContain('map');
    }
  });
});
