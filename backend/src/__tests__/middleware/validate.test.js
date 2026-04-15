import { describe, it, expect, vi, beforeEach } from 'vitest';
const { z } = require('zod');
const { validate } = require('../../middleware/validate');

function createMockRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  return res;
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful validation', () => {
    it('calls next() when body matches schema', () => {
      const middleware = validate(schema);
      const req = { body: { name: 'Alice', age: 30 } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('replaces req.body with parsed (coerced) data', () => {
      const coercingSchema = z.object({
        count: z.coerce.number(),
      });
      const middleware = validate(coercingSchema);
      const req = { body: { count: '42' } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(req.body).toEqual({ count: 42 });
      expect(next).toHaveBeenCalled();
    });

    it('strips unknown keys with strict schema', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      const middleware = validate(strictSchema);
      const req = { body: { name: 'Bob', extra: 'field' } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      // strict() rejects unknown keys, so this should fail
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('ZodError handling', () => {
    it('returns 400 with field details on validation failure', () => {
      const middleware = validate(schema);
      const req = { body: { name: '', age: -5 } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('includes correct field paths in details', () => {
      const middleware = validate(schema);
      const req = { body: {} };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const details = res.json.mock.calls[0][0].details;
      const fields = details.map((d) => d.field);
      expect(fields).toContain('name');
      expect(fields).toContain('age');
    });

    it('handles nested field paths', () => {
      const nestedSchema = z.object({
        address: z.object({
          city: z.string(),
        }),
      });
      const middleware = validate(nestedSchema);
      const req = { body: { address: { city: 123 } } };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const details = res.json.mock.calls[0][0].details;
      expect(details[0].field).toBe('address.city');
    });
  });

  describe('non-Zod error handling', () => {
    it('passes non-Zod errors to next(err)', () => {
      const throwingSchema = {
        parse: () => { throw new Error('Something broke'); },
      };
      const middleware = validate(throwingSchema);
      const req = { body: {} };
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Something broke');
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
