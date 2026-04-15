import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const prisma = require('../../config/database');
const { auditLog, captureOldData } = require('../../middleware/auditLog');

function createMockRes(statusCode = 200) {
  const res = { statusCode };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  return res;
}

describe('auditLog middleware', () => {
  let spyAuditLogCreate, spyUserFindUnique, spyZoneFindUnique;

  beforeEach(() => {
    spyAuditLogCreate = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({});
    spyUserFindUnique = vi.spyOn(prisma.user, 'findUnique');
    spyZoneFindUnique = vi.spyOn(prisma.zone, 'findUnique');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auditLog(action, entity)', () => {
    it('intercepts res.json and logs on 200 status', async () => {
      const middleware = auditLog('create', 'user');
      const req = {
        user: { id: 'u1', firstName: 'John', lastName: 'Doe' },
        params: { id: 'entity1' },
        body: { name: 'test' },
        ip: '127.0.0.1',
      };
      const res = createMockRes(200);
      const next = vi.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      // Now call the intercepted res.json
      res.json({ id: 'entity1', name: 'test' });

      expect(spyAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          userName: 'John Doe',
          action: 'create',
          entity: 'user',
          entityId: 'entity1',
          newData: JSON.stringify({ name: 'test' }),
        }),
      });
    });

    it('logs on 201 status (within 200-299 range)', async () => {
      const middleware = auditLog('create', 'zone');
      const req = {
        user: { id: 'u2', firstName: 'A', lastName: 'B' },
        params: {},
        body: { name: 'zone1' },
        ip: '10.0.0.1',
      };
      const res = createMockRes(201);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ id: 'z1' });

      expect(spyAuditLogCreate).toHaveBeenCalled();
    });

    it('does not log on 400 status', async () => {
      const middleware = auditLog('create', 'user');
      const req = {
        user: { id: 'u1', firstName: 'A', lastName: 'B' },
        params: {},
        body: {},
        ip: '127.0.0.1',
      };
      const res = createMockRes(400);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ error: 'Bad request' });

      expect(spyAuditLogCreate).not.toHaveBeenCalled();
    });

    it('does not log on 500 status', async () => {
      const middleware = auditLog('update', 'post');
      const req = { user: null, params: {}, body: {}, ip: null };
      const res = createMockRes(500);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ error: 'Server error' });

      expect(spyAuditLogCreate).not.toHaveBeenCalled();
    });

    it('uses data.id as entityId when params.id is absent', async () => {
      const middleware = auditLog('create', 'session');
      const req = {
        user: { id: 'u1', firstName: 'X', lastName: 'Y' },
        params: {},
        body: {},
        ip: null,
      };
      const res = createMockRes(200);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ id: 'new-id-123' });

      const logData = spyAuditLogCreate.mock.calls[0][0].data;
      expect(logData.entityId).toBe('new-id-123');
    });

    it('includes oldData from req._auditOldData', async () => {
      const middleware = auditLog('update', 'user');
      const req = {
        user: { id: 'u1', firstName: 'A', lastName: 'B' },
        params: { id: 'u5' },
        body: { name: 'updated' },
        _auditOldData: { name: 'original' },
        ip: '127.0.0.1',
      };
      const res = createMockRes(200);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ id: 'u5' });

      const logData = spyAuditLogCreate.mock.calls[0][0].data;
      expect(logData.oldData).toBe(JSON.stringify({ name: 'original' }));
    });

    it('handles null user gracefully', async () => {
      const middleware = auditLog('delete', 'zone');
      const req = {
        user: null,
        params: { id: 'z1' },
        body: {},
        ip: null,
        connection: { remoteAddress: '192.168.1.1' },
      };
      const res = createMockRes(200);
      const next = vi.fn();

      await middleware(req, res, next);
      res.json({ ok: true });

      const logData = spyAuditLogCreate.mock.calls[0][0].data;
      expect(logData.userId).toBeNull();
      expect(logData.userName).toBeNull();
    });

    it('does not block response if auditLog.create fails', async () => {
      spyAuditLogCreate.mockRejectedValue(new Error('DB down'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const middleware = auditLog('create', 'user');
      const req = {
        user: { id: 'u1', firstName: 'A', lastName: 'B' },
        params: {},
        body: {},
        ip: null,
      };
      const res = createMockRes(200);
      const next = vi.fn();

      await middleware(req, res, next);
      const result = res.json({ id: '1' });

      // Response still returns (fire and forget)
      expect(result).toBe(res);

      // Wait for the rejected promise to settle
      await new Promise((r) => setTimeout(r, 10));
      consoleSpy.mockRestore();
    });
  });

  describe('captureOldData(model)', () => {
    it('fetches old record before mutation', async () => {
      const oldRecord = { id: 'u1', name: 'Old Name' };
      spyUserFindUnique.mockResolvedValue(oldRecord);

      const middleware = captureOldData('User');
      const req = { params: { id: 'u1' } };
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(spyUserFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(req._auditOldData).toEqual(oldRecord);
      expect(next).toHaveBeenCalled();
    });

    it('handles missing model gracefully', async () => {
      const middleware = captureOldData('NonExistentModel');
      const req = { params: { id: '123' } };
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req._auditOldData).toBeUndefined();
    });

    it('handles missing id param', async () => {
      const middleware = captureOldData('User');
      const req = { params: {} };
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(spyUserFindUnique).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles DB error gracefully', async () => {
      spyUserFindUnique.mockRejectedValue(new Error('DB error'));

      const middleware = captureOldData('User');
      const req = { params: { id: 'u1' } };
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('converts model name to lowercase first char for prisma access', async () => {
      spyZoneFindUnique.mockResolvedValue({ id: 'z1', name: 'Zone A' });

      const middleware = captureOldData('Zone');
      const req = { params: { id: 'z1' } };
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(spyZoneFindUnique).toHaveBeenCalledWith({ where: { id: 'z1' } });
      expect(req._auditOldData).toEqual({ id: 'z1', name: 'Zone A' });
    });
  });
});
