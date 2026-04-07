import { describe, it, expect } from 'vitest';

// Test PAGE_PERMISSIONS and ROLE_DEFAULT_PAGES logic
// These are defined in AuthContext but we can test the mapping logic

const PAGE_PERMISSIONS = {
  'dashboard': ['view_dashboard'],
  'dashboard-posts': ['view_dashboard'],
  'posts-detail': ['view_dashboard', 'view_posts'],
  'map': ['view_zones'],
  'map-view': ['view_zones'],
  'map-editor': ['manage_zones'],
  'sessions': ['view_sessions'],
  'work-orders': ['view_work_orders'],
  'events': ['view_events'],
  'analytics': ['view_analytics'],
  'cameras': ['view_cameras'],
  'camera-mapping': ['manage_cameras'],
  'data-1c': ['view_work_orders'],
  'users': ['manage_users'],
};

const ROLE_DEFAULT_PAGES = {
  admin: Object.keys(PAGE_PERMISSIONS),
  manager: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'data-1c'],
  director: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'cameras'],
  mechanic: ['dashboard', 'dashboard-posts', 'map'],
  viewer: ['dashboard', 'posts-detail', 'map'],
};

function buildPermissions(pages, role) {
  const perms = new Set();
  (pages || []).forEach(pageId => {
    const pp = PAGE_PERMISSIONS[pageId];
    if (pp) pp.forEach(p => perms.add(p));
  });
  if (role === 'admin') {
    Object.values(PAGE_PERMISSIONS).flat().forEach(p => perms.add(p));
  }
  return [...perms];
}

describe('PAGE_PERMISSIONS', () => {
  it('has all 14 pages mapped', () => {
    expect(Object.keys(PAGE_PERMISSIONS)).toHaveLength(14);
  });

  it('every page maps to at least one permission', () => {
    Object.entries(PAGE_PERMISSIONS).forEach(([page, perms]) => {
      expect(perms.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('map-editor requires manage_zones', () => {
    expect(PAGE_PERMISSIONS['map-editor']).toContain('manage_zones');
  });

  it('map-view requires view_zones', () => {
    expect(PAGE_PERMISSIONS['map-view']).toContain('view_zones');
  });

  it('users requires manage_users', () => {
    expect(PAGE_PERMISSIONS['users']).toContain('manage_users');
  });
});

describe('ROLE_DEFAULT_PAGES', () => {
  it('admin has all pages', () => {
    expect(ROLE_DEFAULT_PAGES.admin).toEqual(Object.keys(PAGE_PERMISSIONS));
  });

  it('manager has dashboard and data-1c', () => {
    expect(ROLE_DEFAULT_PAGES.manager).toContain('dashboard');
    expect(ROLE_DEFAULT_PAGES.manager).toContain('data-1c');
  });

  it('mechanic has limited pages', () => {
    expect(ROLE_DEFAULT_PAGES.mechanic.length).toBeLessThan(5);
    expect(ROLE_DEFAULT_PAGES.mechanic).toContain('dashboard');
  });

  it('viewer cannot access users or map-editor', () => {
    expect(ROLE_DEFAULT_PAGES.viewer).not.toContain('users');
    expect(ROLE_DEFAULT_PAGES.viewer).not.toContain('map-editor');
  });
});

describe('buildPermissions', () => {
  it('admin gets all permissions', () => {
    const perms = buildPermissions(ROLE_DEFAULT_PAGES.admin, 'admin');
    expect(perms).toContain('manage_users');
    expect(perms).toContain('manage_zones');
    expect(perms).toContain('view_dashboard');
    expect(perms).toContain('view_cameras');
  });

  it('manager gets view permissions but not manage_users', () => {
    const perms = buildPermissions(ROLE_DEFAULT_PAGES.manager, 'manager');
    expect(perms).toContain('view_dashboard');
    expect(perms).toContain('view_work_orders');
    expect(perms).not.toContain('manage_users');
  });

  it('viewer gets minimal permissions', () => {
    const perms = buildPermissions(ROLE_DEFAULT_PAGES.viewer, 'viewer');
    expect(perms).toContain('view_dashboard');
    expect(perms).toContain('view_zones');
    expect(perms).not.toContain('manage_zones');
    expect(perms).not.toContain('manage_users');
  });

  it('empty pages produces no permissions', () => {
    const perms = buildPermissions([], 'viewer');
    expect(perms).toHaveLength(0);
  });

  it('unknown page is ignored', () => {
    const perms = buildPermissions(['nonexistent-page'], 'viewer');
    expect(perms).toHaveLength(0);
  });
});
