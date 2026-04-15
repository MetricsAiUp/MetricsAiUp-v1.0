import { describe, it, expect, vi, beforeEach } from 'vitest';
const { asyncHandler } = require('../../middleware/asyncHandler');

function createMockRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  return res;
}

describe('asyncHandler middleware', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('success path', () => {
    it('calls handler and passes through on success', async () => {
      const handler = vi.fn(async (req, res) => {
        res.json({ ok: true });
      });
      const wrapped = asyncHandler(handler);
      const req = { method: 'GET', path: '/test' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(handler).toHaveBeenCalledWith(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('passes req, res, next to the handler', async () => {
      const handler = vi.fn(async () => {});
      const wrapped = asyncHandler(handler);
      const req = { method: 'POST', path: '/api/data' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(handler).toHaveBeenCalledWith(req, res, next);
    });

    it('handles synchronous handlers', async () => {
      const handler = vi.fn((req, res) => {
        res.json({ sync: true });
      });
      const wrapped = asyncHandler(handler);
      const req = { method: 'GET', path: '/sync' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ sync: true });
    });
  });

  describe('error handling', () => {
    it('catches rejected promises and sends 500', async () => {
      const handler = vi.fn(async () => {
        throw new Error('Something failed');
      });
      const wrapped = asyncHandler(handler);
      const req = { method: 'GET', path: '/fail' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something failed' });
    });

    it('handles Prisma P2025 error with 404', async () => {
      const prismaError = new Error('Record not found');
      prismaError.code = 'P2025';

      const handler = vi.fn(async () => { throw prismaError; });
      const wrapped = asyncHandler(handler);
      const req = { method: 'DELETE', path: '/api/items/123' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('logs error to console with method and path', async () => {
      const handler = vi.fn(async () => {
        throw new Error('DB connection lost');
      });
      const wrapped = asyncHandler(handler);
      const req = { method: 'PUT', path: '/api/users/5' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Route Error] PUT /api/users/5:',
        'DB connection lost',
      );
    });

    it('does not log P2025 errors to console (returns 404 before logging)', async () => {
      const prismaError = new Error('Record not found');
      prismaError.code = 'P2025';

      const handler = vi.fn(async () => { throw prismaError; });
      const wrapped = asyncHandler(handler);
      const req = { method: 'GET', path: '/api/x' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      // P2025 returns early before console.error
      expect(res.status).toHaveBeenCalledWith(404);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('sends error.message in the 500 response body', async () => {
      const handler = vi.fn(async () => {
        throw new Error('Detailed error info');
      });
      const wrapped = asyncHandler(handler);
      const req = { method: 'POST', path: '/api/create' };
      const res = createMockRes();
      const next = vi.fn();

      await wrapped(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ error: 'Detailed error info' });
    });
  });
});
