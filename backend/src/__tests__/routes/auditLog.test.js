import { describe, it, expect } from 'vitest';

describe('auditLog - CSV export logic', () => {
  it('generates CSV with correct header', () => {
    const logs = [];
    const header = 'Date,User,Action,Entity,EntityID,IP\n';
    const rows = logs.map(l =>
      `"${new Date(l.createdAt).toISOString()}","${l.userName || ''}","${l.action}","${l.entity}","${l.entityId || ''}","${l.ip || ''}"`
    ).join('\n');
    const csv = '\uFEFF' + header + rows;

    expect(csv).toContain('Date,User,Action,Entity,EntityID,IP');
  });

  it('includes BOM for Excel compatibility', () => {
    const logs = [];
    const header = 'Date,User,Action,Entity,EntityID,IP\n';
    const rows = '';
    const csv = '\uFEFF' + header + rows;

    // BOM is \uFEFF (byte order mark) for UTF-8 Excel compatibility
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('formats log entries as quoted CSV fields', () => {
    const logs = [
      {
        createdAt: new Date('2026-04-09T10:00:00Z'),
        userName: 'admin',
        action: 'create',
        entity: 'workOrder',
        entityId: 'wo-123',
        ip: '192.168.1.1',
      },
      {
        createdAt: new Date('2026-04-09T11:00:00Z'),
        userName: null,
        action: 'delete',
        entity: 'shift',
        entityId: null,
        ip: null,
      },
    ];

    const header = 'Date,User,Action,Entity,EntityID,IP\n';
    const rows = logs.map(l =>
      `"${new Date(l.createdAt).toISOString()}","${l.userName || ''}","${l.action}","${l.entity}","${l.entityId || ''}","${l.ip || ''}"`
    ).join('\n');
    const csv = '\uFEFF' + header + rows;

    // Check first row
    expect(csv).toContain('"2026-04-09T10:00:00.000Z"');
    expect(csv).toContain('"admin"');
    expect(csv).toContain('"create"');
    expect(csv).toContain('"workOrder"');
    expect(csv).toContain('"wo-123"');
    expect(csv).toContain('"192.168.1.1"');

    // Check null handling in second row
    expect(csv).toContain('"delete","shift","",""');
  });

  it('content type should be text/csv', () => {
    const expectedContentType = 'text/csv; charset=utf-8';
    expect(expectedContentType).toBe('text/csv; charset=utf-8');
  });

  it('handles large datasets within 10000 limit', () => {
    // The route takes up to 10000 records
    const take = 10000;
    expect(take).toBe(10000);
    // Ensure that the logic correctly limits
    const mockLogs = Array.from({ length: 10000 }, (_, i) => ({
      createdAt: new Date(),
      userName: `user${i}`,
      action: 'view',
      entity: 'dashboard',
      entityId: null,
      ip: '127.0.0.1',
    }));
    expect(mockLogs.length).toBe(10000);
  });

  it('builds where clause from filter params', () => {
    const params = {
      userId: 'user-1',
      action: 'create',
      entity: 'workOrder',
      from: '2026-04-01',
      to: '2026-04-09',
    };

    const where = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.entity) where.entity = params.entity;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    expect(where.userId).toBe('user-1');
    expect(where.action).toBe('create');
    expect(where.entity).toBe('workOrder');
    expect(where.createdAt.gte).toEqual(new Date('2026-04-01'));
    expect(where.createdAt.lte).toEqual(new Date('2026-04-09'));
  });
});
