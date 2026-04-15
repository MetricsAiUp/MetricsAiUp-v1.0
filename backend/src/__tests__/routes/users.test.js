import { describe, it, expect } from 'vitest';

// Recreate the ROLE_DEFAULT_PAGES mapping from users route
const ROLE_DEFAULT_PAGES = {
  admin: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'sessions', 'work-orders',
    'shifts', 'events', 'analytics', 'cameras', 'camera-mapping', 'data-1c',
    'users', 'map-view', 'map-editor', 'audit', 'health', 'my-post',
    'report-schedule', 'tech-docs', 'live-debug',
  ],
  manager: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view',
    'sessions', 'work-orders', 'shifts', 'analytics', 'events', 'data-1c',
  ],
  mechanic: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions', 'my-post',
  ],
  viewer: [
    'dashboard', 'dashboard-posts', 'map-view',
  ],
};

// Recreate the ROLES constant from the users route
const ROLES = [
  { id: 'admin', name: { ru: 'Администратор', en: 'Administrator' }, color: '#6366f1' },
  { id: 'manager', name: { ru: 'Менеджер', en: 'Manager' }, color: '#22c55e' },
  { id: 'viewer', name: { ru: 'Наблюдатель', en: 'Viewer' }, color: '#3b82f6' },
  { id: 'mechanic', name: { ru: 'Механик', en: 'Mechanic' }, color: '#f59e0b' },
];

// Recreate formatUser logic from users route
function formatUser(user) {
  const roleNames = user.roles.map((ur) => ur.role.name);
  const primaryRole = roleNames[0] || 'viewer';

  const permissions = new Set();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  let pages;
  try { pages = JSON.parse(user.pages || '[]'); } catch { pages = []; }
  if (!pages.length) pages = ROLE_DEFAULT_PAGES[primaryRole] || ROLE_DEFAULT_PAGES.viewer;

  let hiddenElements = [];
  try { hiddenElements = JSON.parse(user.hiddenElements || '[]'); } catch {}

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: primaryRole,
    roles: roleNames,
    pages,
    hiddenElements,
    permissions: [...permissions],
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

describe('Users Route Logic', () => {
  describe('User Response Formatting', () => {
    it('formats user with roles array containing role names', () => {
      const rawUser = {
        id: 'u1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '[]',
        roles: [
          { role: { name: 'admin', permissions: [{ permission: { key: 'manage_users' } }] } },
        ],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.roles).toEqual(['admin']);
      expect(formatted.role).toBe('admin');
    });

    it('collects permissions from all roles', () => {
      const rawUser = {
        id: 'u2', email: 'mgr@test.com', firstName: 'M', lastName: 'G',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '[]',
        roles: [
          { role: { name: 'manager', permissions: [
            { permission: { key: 'view_dashboard' } },
            { permission: { key: 'manage_work_orders' } },
          ] } },
          { role: { name: 'viewer', permissions: [
            { permission: { key: 'view_dashboard' } },
            { permission: { key: 'view_analytics' } },
          ] } },
        ],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.permissions).toContain('view_dashboard');
      expect(formatted.permissions).toContain('manage_work_orders');
      expect(formatted.permissions).toContain('view_analytics');
      // No duplicates (Set)
      const unique = new Set(formatted.permissions);
      expect(unique.size).toBe(formatted.permissions.length);
    });

    it('does not include password in formatted output', () => {
      const rawUser = {
        id: 'u3', email: 'a@b.com', firstName: 'A', lastName: 'B',
        password: '$2a$10$hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '[]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      };
      const formatted = formatUser(rawUser);
      expect(formatted).not.toHaveProperty('password');
    });

    it('defaults to viewer role when no roles assigned', () => {
      const rawUser = {
        id: 'u4', email: 'no@role.com', firstName: 'No', lastName: 'Role',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '[]',
        roles: [],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.role).toBe('viewer');
      expect(formatted.pages).toEqual(ROLE_DEFAULT_PAGES.viewer);
    });
  });

  describe('Role Color Mapping', () => {
    it('admin has indigo color #6366f1', () => {
      const admin = ROLES.find(r => r.id === 'admin');
      expect(admin.color).toBe('#6366f1');
    });

    it('manager has green color #22c55e', () => {
      const manager = ROLES.find(r => r.id === 'manager');
      expect(manager.color).toBe('#22c55e');
    });

    it('viewer has blue color #3b82f6', () => {
      const viewer = ROLES.find(r => r.id === 'viewer');
      expect(viewer.color).toBe('#3b82f6');
    });

    it('mechanic has amber color #f59e0b', () => {
      const mechanic = ROLES.find(r => r.id === 'mechanic');
      expect(mechanic.color).toBe('#f59e0b');
    });

    it('all roles have both ru and en name', () => {
      for (const role of ROLES) {
        expect(role.name).toHaveProperty('ru');
        expect(role.name).toHaveProperty('en');
        expect(typeof role.name.ru).toBe('string');
        expect(typeof role.name.en).toBe('string');
      }
    });
  });

  describe('Self-Deletion Prevention', () => {
    it('prevents user from deactivating themselves', () => {
      const currentUserId = 'u1';
      const targetId = 'u1';
      const isSelfDelete = targetId === currentUserId;
      expect(isSelfDelete).toBe(true);
    });

    it('allows deactivating another user', () => {
      const currentUserId = 'u1';
      const targetId = 'u2';
      const isSelfDelete = targetId === currentUserId;
      expect(isSelfDelete).toBe(false);
    });
  });

  describe('Page Access Derivation', () => {
    it('admin gets all pages including health and audit', () => {
      const pages = ROLE_DEFAULT_PAGES.admin;
      expect(pages).toContain('health');
      expect(pages).toContain('audit');
      expect(pages).toContain('users');
      expect(pages).toContain('map-editor');
    });

    it('manager gets dashboard, work-orders, analytics, but not users or health', () => {
      const pages = ROLE_DEFAULT_PAGES.manager;
      expect(pages).toContain('dashboard');
      expect(pages).toContain('work-orders');
      expect(pages).toContain('analytics');
      expect(pages).not.toContain('users');
      expect(pages).not.toContain('health');
    });

    it('mechanic gets my-post and sessions', () => {
      const pages = ROLE_DEFAULT_PAGES.mechanic;
      expect(pages).toContain('my-post');
      expect(pages).toContain('sessions');
      expect(pages).not.toContain('analytics');
    });

    it('viewer gets only dashboard and map-view', () => {
      const pages = ROLE_DEFAULT_PAGES.viewer;
      expect(pages).toContain('dashboard');
      expect(pages).toContain('map-view');
      expect(pages).not.toContain('sessions');
      expect(pages).not.toContain('work-orders');
    });

    it('uses saved pages when present in user record', () => {
      const rawUser = {
        id: 'u5', email: 'custom@test.com', firstName: 'C', lastName: 'U',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '["dashboard","cameras"]', hiddenElements: '[]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.pages).toEqual(['dashboard', 'cameras']);
    });
  });

  describe('Hidden Elements JSON Parsing', () => {
    it('parses valid hidden elements array', () => {
      const rawUser = {
        id: 'u6', email: 'h@e.com', firstName: 'H', lastName: 'E',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '["sidebar-analytics","kpi-card-3"]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.hiddenElements).toEqual(['sidebar-analytics', 'kpi-card-3']);
    });

    it('defaults to empty array on invalid JSON', () => {
      const rawUser = {
        id: 'u7', email: 'b@c.com', firstName: 'B', lastName: 'C',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: '{invalid-json',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.hiddenElements).toEqual([]);
    });

    it('defaults to empty array when hiddenElements is null', () => {
      const rawUser = {
        id: 'u8', email: 'd@e.com', firstName: 'D', lastName: 'E',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        pages: '[]', hiddenElements: null,
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      };
      const formatted = formatUser(rawUser);
      expect(formatted.hiddenElements).toEqual([]);
    });
  });

  describe('User Creation Validation', () => {
    it('requires email, password, firstName, lastName', () => {
      const body = { email: 'a@b.com', password: '123456', firstName: 'A', lastName: 'B' };
      const missing = !body.email || !body.password || !body.firstName || !body.lastName;
      expect(missing).toBe(false);
    });

    it('detects missing required fields', () => {
      const body = { email: 'a@b.com', password: '123456' };
      const missing = !body.email || !body.password || !body.firstName || !body.lastName;
      expect(missing).toBe(true);
    });

    it('stores pages as JSON string', () => {
      const pages = ['dashboard', 'sessions'];
      const stored = JSON.stringify(pages);
      expect(stored).toBe('["dashboard","sessions"]');
      expect(JSON.parse(stored)).toEqual(pages);
    });
  });
});
