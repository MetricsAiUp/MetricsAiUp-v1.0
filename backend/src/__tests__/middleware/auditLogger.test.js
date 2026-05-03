import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const prisma = require('../../config/database');
const { auditLogger, redact, safeStringify } = require('../../middleware/auditLogger');

function makeReq({ method = 'POST', url = '/api/users', body = {}, user = null, params = {}, headers = {}, ip = '127.0.0.1' } = {}) {
  return { method, originalUrl: url, body, user, params, headers, ip };
}

function makeRes(statusCode = 200) {
  const res = { statusCode };
  res.json = vi.fn(() => res);
  return res;
}

describe('auditLogger middleware', () => {
  let spyCreate;

  beforeEach(() => {
    spyCreate = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('логирует POST /api/users как create user', async () => {
    const req = makeReq({ method: 'POST', url: '/api/users', body: { email: 'a@b.c' }, user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов' } });
    const res = makeRes(201);
    const next = vi.fn();

    auditLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    res.json({ id: 'new-user' });

    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        userName: 'Иван Иванов',
        action: 'create',
        entity: 'user',
        entityId: 'new-user',
        ip: '127.0.0.1',
      }),
    });
  });

  it('логирует PUT /api/zones/:id как update zone с oldData', async () => {
    const req = makeReq({ method: 'PUT', url: '/api/zones/z1', body: { name: 'New' }, user: { id: 'u1', firstName: 'A', lastName: 'B' }, params: { id: 'z1' } });
    req._auditOldData = { name: 'Old' };
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ id: 'z1' });

    await new Promise(r => setTimeout(r, 5));
    const data = spyCreate.mock.calls[0][0].data;
    expect(data.action).toBe('update');
    expect(data.entity).toBe('zone');
    expect(data.entityId).toBe('z1');
    expect(data.oldData).toBe(JSON.stringify({ name: 'Old' }));
    expect(data.newData).toBe(JSON.stringify({ name: 'New' }));
  });

  it('логирует DELETE /api/cameras/:id как delete camera', async () => {
    const req = makeReq({ method: 'DELETE', url: '/api/cameras/cam01', user: { id: 'u1' }, params: { id: 'cam01' } });
    auditLogger(req, makeRes(200), vi.fn());
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ ok: true });

    await new Promise(r => setTimeout(r, 5));
    const data = spyCreate.mock.calls.at(-1)[0].data;
    expect(data.action).toBe('delete');
    expect(data.entity).toBe('camera');
    expect(data.entityId).toBe('cam01');
  });

  it('логирует POST /api/auth/login как login и достаёт user из ответа', async () => {
    const req = makeReq({ method: 'POST', url: '/api/auth/login', body: { email: 'a@b.c', password: 'secret' }, user: null });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ accessToken: 'jwt', user: { id: 'u9', firstName: 'Demo', lastName: 'User' } });

    await new Promise(r => setTimeout(r, 5));
    const data = spyCreate.mock.calls[0][0].data;
    expect(data.action).toBe('login');
    expect(data.entity).toBe('auth');
    expect(data.userId).toBe('u9');
    expect(data.userName).toBe('Demo User');
    // captureBody=false для login → newData не пишем
    expect(data.newData).toBeNull();
  });

  it('маскирует password/token/secret в newData', async () => {
    const req = makeReq({ method: 'PUT', url: '/api/users/u1', body: { email: 'x@y.z', password: 'P@ss', token: 'tok', nested: { refreshToken: 'r' } }, user: { id: 'admin' }, params: { id: 'u1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ id: 'u1' });

    await new Promise(r => setTimeout(r, 5));
    const newData = JSON.parse(spyCreate.mock.calls[0][0].data.newData);
    expect(newData.password).toBe('[REDACTED]');
    expect(newData.token).toBe('[REDACTED]');
    expect(newData.nested.refreshToken).toBe('[REDACTED]');
    expect(newData.email).toBe('x@y.z');
  });

  it('обрезает длинные тела до 8KB', async () => {
    const huge = 'x'.repeat(20000);
    const req = makeReq({ method: 'POST', url: '/api/zones', body: { description: huge }, user: { id: 'u1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ id: 'z2' });

    await new Promise(r => setTimeout(r, 5));
    const newData = spyCreate.mock.calls[0][0].data.newData;
    expect(newData.length).toBeLessThanOrEqual(8000 + '...[truncated]'.length);
    expect(newData.endsWith('...[truncated]')).toBe(true);
  });

  it('пропускает GET-запросы', async () => {
    const req = makeReq({ method: 'GET', url: '/api/users', user: { id: 'u1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json([]);

    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('пропускает шумные пути (push, photos, audit-log, dashboard, monitoring)', async () => {
    for (const url of ['/api/push/subscribe', '/api/photos', '/api/audit-log/x', '/api/dashboard/foo', '/api/monitoring/state']) {
      const req = makeReq({ method: 'POST', url, user: { id: 'u1' } });
      const res = makeRes(200);
      auditLogger(req, res, vi.fn());
      res.json({ ok: true });
    }
    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('пропускает не-/api/* пути', async () => {
    const req = makeReq({ method: 'POST', url: '/some-other-path', user: { id: 'u1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ ok: true });
    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('не логирует неуспешные ответы (4xx, 5xx)', async () => {
    for (const code of [400, 403, 404, 500]) {
      const req = makeReq({ method: 'POST', url: '/api/zones', body: {}, user: { id: 'u1' } });
      const res = makeRes(code);
      auditLogger(req, res, vi.fn());
      res.json({ error: 'x' });
    }
    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('берёт IP из X-Forwarded-For (первый хоп)', async () => {
    const req = makeReq({ method: 'POST', url: '/api/zones', body: {}, user: { id: 'u1' }, headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    res.json({ id: 'z3' });
    await new Promise(r => setTimeout(r, 5));
    expect(spyCreate.mock.calls[0][0].data.ip).toBe('203.0.113.5');
  });

  it('не падает если auditLog.create отвергнут (fire-and-forget)', async () => {
    spyCreate.mockRejectedValue(new Error('DB down'));
    const req = makeReq({ method: 'POST', url: '/api/zones', body: { x: 1 }, user: { id: 'u1' } });
    const res = makeRes(200);
    auditLogger(req, res, vi.fn());
    const result = res.json({ id: 'z9' });
    expect(result).toBe(res);
    await new Promise(r => setTimeout(r, 10));
  });
});

describe('redact / safeStringify', () => {
  it('redact не трогает примитивы', () => {
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact('x')).toBe('x');
  });

  it('redact работает рекурсивно по массивам и объектам', () => {
    const r = redact({ a: [{ password: 'p' }, { token: 't', ok: 1 }] });
    expect(r.a[0].password).toBe('[REDACTED]');
    expect(r.a[1].token).toBe('[REDACTED]');
    expect(r.a[1].ok).toBe(1);
  });

  it('safeStringify возвращает null для null', () => {
    expect(safeStringify(null)).toBeNull();
  });
});
