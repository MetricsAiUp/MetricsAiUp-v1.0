import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth, PAGE_ELEMENTS } from '../AuthContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));

vi.mock('../../hooks/useSocket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(() => null),
}));

// Dynamically import the mocked module so we can reference spies
import { connectSocket, disconnectSocket } from '../../hooks/useSocket';

describe('AuthContext', () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Stub global fetch to avoid real network calls
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides user as null initially when no token in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it('login() stores token and user in localStorage', async () => {
    // Mock successful login + /api/auth/me
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'test-token-123',
            user: { id: 1, email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'admin',
            pages: ['dashboard'],
            permissions: ['view_dashboard'],
            hiddenElements: [],
          }),
      })
      // settings fetch after login
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ mode: 'demo' }),
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('admin@test.com', 'password');
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user.email).toBe('admin@test.com');
    expect(localStorage.getItem('token')).toBe('test-token-123');
    expect(localStorage.getItem('currentUser')).toBeTruthy();
  });

  it('logout() clears token and user, calls disconnectSocket', async () => {
    // Pre-populate localStorage as if user is logged in
    localStorage.setItem('token', 'existing-token');
    localStorage.setItem('currentUser', JSON.stringify({ id: 1, email: 'a@b.com', role: 'admin', permissions: [] }));

    // Mock settings fetch that happens on mount when token exists
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(disconnectSocket).toHaveBeenCalled();
  });

  it('hasPermission() returns true for admin role', async () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: 1,
        email: 'admin@test.com',
        role: 'admin',
        permissions: ['view_dashboard', 'manage_users', 'manage_zones', 'manage_cameras'],
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.hasPermission('manage_users')).toBe(true);
    expect(result.current.hasPermission('view_dashboard')).toBe(true);
  });

  it('hasPermission() returns false for missing permission', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: 1,
        email: 'viewer@test.com',
        role: 'viewer',
        permissions: ['view_dashboard'],
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.hasPermission('manage_users')).toBe(false);
    expect(result.current.hasPermission('manage_cameras')).toBe(false);
  });

  it('isElementVisible() returns true when element not in hiddenElements', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: 1,
        role: 'admin',
        permissions: [],
        hiddenElements: ['dashboard.liveWidget'],
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isElementVisible('dashboard', 'statCards')).toBe(true);
  });

  it('isElementVisible() returns false when element is hidden', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: 1,
        role: 'admin',
        permissions: [],
        hiddenElements: ['dashboard.liveWidget'],
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isElementVisible('dashboard', 'liveWidget')).toBe(false);
  });

  it('appMode defaults to demo', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.appMode).toBe('demo');
  });

  it('toggleAppMode changes mode', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.toggleAppMode('live');
    });

    expect(result.current.appMode).toBe('live');
    expect(localStorage.getItem('appMode')).toBe('live');
  });

  it('PAGE_ELEMENTS has correct page structure', () => {
    expect(PAGE_ELEMENTS).toHaveProperty('dashboard');
    expect(PAGE_ELEMENTS).toHaveProperty('dashboard-posts');
    expect(PAGE_ELEMENTS).toHaveProperty('posts-detail');
    expect(PAGE_ELEMENTS).toHaveProperty('analytics');

    // dashboard has 5 elements
    expect(PAGE_ELEMENTS.dashboard).toHaveLength(5);
    expect(PAGE_ELEMENTS.dashboard[0]).toHaveProperty('id');
    expect(PAGE_ELEMENTS.dashboard[0]).toHaveProperty('label');
    expect(PAGE_ELEMENTS.dashboard[0].label).toHaveProperty('ru');
    expect(PAGE_ELEMENTS.dashboard[0].label).toHaveProperty('en');

    // dashboard-posts has 4 elements
    expect(PAGE_ELEMENTS['dashboard-posts']).toHaveLength(4);

    // posts-detail has 11 elements
    expect(PAGE_ELEMENTS['posts-detail']).toHaveLength(11);

    // analytics has 7 elements
    expect(PAGE_ELEMENTS.analytics).toHaveLength(7);
  });
});

// These tests import the module internals indirectly via the AuthContext module
// We re-import to test the non-exported helpers through observable behavior
describe('AuthContext internals (observable via behavior)', () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildPermissions gives admin all permissions', async () => {
    // Login as admin and verify all key permissions are present
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'admin-tok',
            user: { id: 1, email: 'admin@test.com', firstName: 'A', lastName: 'B' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'admin',
            pages: ['dashboard'],
            permissions: [],
            hiddenElements: [],
          }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('admin@test.com', 'pass');
    });

    const perms = result.current.user.permissions;
    expect(perms).toContain('manage_users');
    expect(perms).toContain('manage_roles');
    expect(perms).toContain('manage_settings');
    expect(perms).toContain('manage_cameras');
    expect(perms).toContain('manage_work_orders');
    expect(perms).toContain('manage_zones');
    expect(perms).toContain('view_recommendations');
    expect(perms).toContain('view_dashboard');
  });

  it('login throws on network error (no mock fallback)', async () => {
    globalThis.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await expect(result.current.login('admin@t.com', 'pass')).rejects.toThrow();
    });
  });
});
