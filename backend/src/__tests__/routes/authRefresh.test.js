import { describe, it, expect } from 'vitest';
import { buildReqUser } from '../../middleware/auth.js';

describe('/auth/refresh — buildReqUser возвращает полные данные пользователя', () => {
  it('включает permissions из всех ролей', () => {
    const rawUser = {
      id: 'u-1', email: 'admin@test', firstName: 'A', lastName: 'B',
      pages: null, hiddenElements: null,
      roles: [
        { role: { name: 'admin', permissions: [
          { permission: { key: 'manage_users' } },
          { permission: { key: 'view_dashboard' } },
        ] } },
      ],
    };
    const req = buildReqUser(rawUser);
    expect(req.permissions).toContain('manage_users');
    expect(req.permissions).toContain('view_dashboard');
    expect(req.role).toBe('admin');
    expect(req.roles).toEqual(['admin']);
  });

  it('возвращает дефолтные pages из ROLE_PAGES если БД не содержит pages', () => {
    const rawUser = {
      id: 'u-2', email: 'manager@test', firstName: 'M', lastName: 'N',
      pages: '[]', hiddenElements: null,
      roles: [{ role: { name: 'manager', permissions: [] } }],
    };
    const req = buildReqUser(rawUser);
    expect(req.pages).toContain('dashboard');
    expect(req.pages).toContain('work-orders');
    expect(req.pages).not.toContain('users');
  });

  it('использует сохранённые pages если они заданы', () => {
    const rawUser = {
      id: 'u-3', email: 'v@t', firstName: 'V', lastName: 'V',
      pages: '["dashboard","cameras"]', hiddenElements: null,
      roles: [{ role: { name: 'viewer', permissions: [] } }],
    };
    const req = buildReqUser(rawUser);
    expect(req.pages).toEqual(['dashboard', 'cameras']);
  });

  it('parses hiddenElements корректно', () => {
    const rawUser = {
      id: 'u-4', email: 'h@t', firstName: 'H', lastName: 'H',
      pages: null, hiddenElements: '["dashboard.statCards"]',
      roles: [{ role: { name: 'viewer', permissions: [] } }],
    };
    const req = buildReqUser(rawUser);
    expect(req.hiddenElements).toEqual(['dashboard.statCards']);
  });

  it('не возвращает поле password', () => {
    const rawUser = {
      id: 'u-5', email: 'p@t', firstName: 'P', lastName: 'P',
      password: '$2a$10$xxx', pages: null, hiddenElements: null,
      roles: [{ role: { name: 'viewer', permissions: [] } }],
    };
    const req = buildReqUser(rawUser);
    expect(req).not.toHaveProperty('password');
  });

  it('по умолчанию роль viewer', () => {
    const rawUser = {
      id: 'u-6', email: 'n@t', firstName: 'N', lastName: 'N',
      pages: null, hiddenElements: null,
      roles: [],
    };
    const req = buildReqUser(rawUser);
    expect(req.role).toBe('viewer');
    expect(req.pages).toEqual(['dashboard', 'dashboard-posts', 'map-view']);
  });
});
