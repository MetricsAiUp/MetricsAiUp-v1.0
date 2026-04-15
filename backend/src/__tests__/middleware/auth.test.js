import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const authCache = require('../../config/authCache');
const { authenticate, requirePermission } = require('../../middleware/auth');

function createMockRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  return res;
}

function createMockReq(headers = {}) {
  return { headers };
}

describe('auth middleware', () => {
  let spyVerify, spyFindUnique, spyCacheGet, spyCacheSet;

  beforeEach(() => {
    spyVerify = vi.spyOn(jwt, 'verify');
    spyFindUnique = vi.spyOn(prisma.user, 'findUnique');
    spyCacheGet = vi.spyOn(authCache, 'get');
    spyCacheSet = vi.spyOn(authCache, 'set').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── ROLE_PAGES ──────────────────────────────────────────────
  describe('ROLE_PAGES constant', () => {
    it('admin role produces 20 pages when user.pages is empty', async () => {
      spyVerify.mockReturnValue({ userId: 'u1' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'admin', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.pages).toContain('dashboard');
      expect(req.user.pages).toContain('map-editor');
      expect(req.user.pages).toContain('health');
      expect(req.user.pages.length).toBe(20);
    });

    it('viewer role produces 3 pages when user.pages is empty', async () => {
      spyVerify.mockReturnValue({ userId: 'u2' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u2', email: 'v@b.c', firstName: 'V', lastName: 'W',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages).toEqual(['dashboard', 'dashboard-posts', 'map-view']);
    });

    it('mechanic role has 6 pages', async () => {
      spyVerify.mockReturnValue({ userId: 'u3' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u3', email: 'm@b.c', firstName: 'M', lastName: 'N',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'mechanic', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages).toEqual(['dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions', 'my-post']);
    });

    it('director role has 9 pages', async () => {
      spyVerify.mockReturnValue({ userId: 'u3b' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u3b', email: 'd@b.c', firstName: 'D', lastName: 'R',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'director', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages.length).toBe(9);
      expect(req.user.pages).toContain('analytics');
      expect(req.user.pages).toContain('cameras');
    });

    it('manager role has 10 pages', async () => {
      spyVerify.mockReturnValue({ userId: 'u3c' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u3c', email: 'mgr@b.c', firstName: 'Mgr', lastName: 'R',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'manager', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages.length).toBe(10);
      expect(req.user.pages).toContain('data-1c');
      expect(req.user.pages).toContain('shifts');
    });
  });

  // ── buildReqUser (tested indirectly through authenticate) ───
  describe('buildReqUser logic', () => {
    it('extracts permissions from nested roles structure', async () => {
      spyVerify.mockReturnValue({ userId: 'u4' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u4', email: 'x@b.c', firstName: 'X', lastName: 'Y',
        isActive: true, hiddenElements: null, pages: '["dashboard"]',
        roles: [{
          role: {
            name: 'manager',
            permissions: [
              { permission: { key: 'view_dashboard' } },
              { permission: { key: 'manage_work_orders' } },
            ],
          },
        }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.permissions).toContain('view_dashboard');
      expect(req.user.permissions).toContain('manage_work_orders');
      expect(req.user.permissions.length).toBe(2);
    });

    it('deduplicates permissions across multiple roles', async () => {
      spyVerify.mockReturnValue({ userId: 'u5' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u5', email: 'z@b.c', firstName: 'Z', lastName: 'W',
        isActive: true, hiddenElements: null, pages: '["dashboard"]',
        roles: [
          { role: { name: 'admin', permissions: [{ permission: { key: 'view_dashboard' } }] } },
          { role: { name: 'manager', permissions: [{ permission: { key: 'view_dashboard' } }] } },
        ],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.permissions).toEqual(['view_dashboard']);
    });

    it('parses hiddenElements JSON', async () => {
      spyVerify.mockReturnValue({ userId: 'u6' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u6', email: 'h@b.c', firstName: 'H', lastName: 'E',
        isActive: true, hiddenElements: '["elem1","elem2"]', pages: '["dashboard"]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.hiddenElements).toEqual(['elem1', 'elem2']);
    });

    it('falls back to empty array when hiddenElements is invalid JSON', async () => {
      spyVerify.mockReturnValue({ userId: 'u7' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u7', email: 'bad@b.c', firstName: 'B', lastName: 'J',
        isActive: true, hiddenElements: '{invalid', pages: '["dashboard"]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.hiddenElements).toEqual([]);
    });

    it('uses saved pages when present', async () => {
      spyVerify.mockReturnValue({ userId: 'u8' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u8', email: 'p@b.c', firstName: 'P', lastName: 'Q',
        isActive: true, hiddenElements: null,
        pages: '["dashboard","analytics","cameras"]',
        roles: [{ role: { name: 'viewer', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages).toEqual(['dashboard', 'analytics', 'cameras']);
    });

    it('falls back to ROLE_PAGES when pages is empty array', async () => {
      spyVerify.mockReturnValue({ userId: 'u9' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u9', email: 'e@b.c', firstName: 'E', lastName: 'F',
        isActive: true, hiddenElements: null, pages: '[]',
        roles: [{ role: { name: 'director', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages).toContain('analytics');
      expect(req.user.pages).toContain('cameras');
    });

    it('falls back to ["dashboard"] for unknown role', async () => {
      spyVerify.mockReturnValue({ userId: 'u10' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u10', email: 'u@b.c', firstName: 'U', lastName: 'K',
        isActive: true, hiddenElements: null, pages: null,
        roles: [{ role: { name: 'unknown_role', permissions: [] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.pages).toEqual(['dashboard']);
    });

    it('sets role to primaryRole (first role name)', async () => {
      spyVerify.mockReturnValue({ userId: 'u10b' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u10b', email: 'mr@b.c', firstName: 'M', lastName: 'R',
        isActive: true, hiddenElements: null, pages: '["dashboard"]',
        roles: [
          { role: { name: 'manager', permissions: [] } },
          { role: { name: 'viewer', permissions: [] } },
        ],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();
      await authenticate(req, res, next);

      expect(req.user.role).toBe('manager');
      expect(req.user.roles).toEqual(['manager', 'viewer']);
    });
  });

  // ── authenticate middleware ─────────────────────────────────
  describe('authenticate', () => {
    it('returns 401 without Authorization header', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for non-Bearer token', async () => {
      const req = createMockReq({ authorization: 'Basic abc123' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for refresh tokens', async () => {
      spyVerify.mockReturnValue({ userId: 'u1', type: 'refresh' });

      const req = createMockReq({ authorization: 'Bearer refresh-tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Используйте access token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('uses auth cache when available', async () => {
      const cachedUser = { id: 'u1', email: 'cached@b.c', permissions: ['view_dashboard'] };
      spyVerify.mockReturnValue({ userId: 'u1' });
      spyCacheGet.mockReturnValue(cachedUser);

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBe(cachedUser);
      expect(spyFindUnique).not.toHaveBeenCalled();
    });

    it('returns 401 for inactive users', async () => {
      spyVerify.mockReturnValue({ userId: 'inactive1' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'inactive1', isActive: false, roles: [],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when user not found in DB', async () => {
      spyVerify.mockReturnValue({ userId: 'ghost' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue(null);

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when jwt.verify throws', async () => {
      spyVerify.mockImplementation(() => { throw new Error('invalid'); });

      const req = createMockReq({ authorization: 'Bearer bad-tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Невалидный токен' });
    });

    it('sets user on req and caches after successful DB lookup', async () => {
      spyVerify.mockReturnValue({ userId: 'u11' });
      spyCacheGet.mockReturnValue(null);
      spyFindUnique.mockResolvedValue({
        id: 'u11', email: 'ok@b.c', firstName: 'O', lastName: 'K',
        isActive: true, hiddenElements: null, pages: '["dashboard"]',
        roles: [{ role: { name: 'admin', permissions: [{ permission: { key: 'all' } }] } }],
      });

      const req = createMockReq({ authorization: 'Bearer tok' });
      const res = createMockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe('u11');
      expect(req.user.email).toBe('ok@b.c');
      expect(spyCacheSet).toHaveBeenCalledWith('u11', req.user);
    });
  });

  // ── requirePermission middleware ────────────────────────────
  describe('requirePermission', () => {
    it('returns 401 without req.user', () => {
      const middleware = requirePermission('view_dashboard');
      const req = {};
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 without matching permission', () => {
      const middleware = requirePermission('manage_users');
      const req = { user: { permissions: ['view_dashboard'] } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Недостаточно прав' });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() with matching permission', () => {
      const middleware = requirePermission('view_dashboard');
      const req = { user: { permissions: ['view_dashboard', 'view_analytics'] } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('accepts any of multiple keys (keys.some())', () => {
      const middleware = requirePermission('manage_users', 'manage_cameras');
      const req = { user: { permissions: ['manage_cameras'] } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('rejects when none of multiple keys match', () => {
      const middleware = requirePermission('manage_users', 'manage_cameras');
      const req = { user: { permissions: ['view_dashboard'] } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
