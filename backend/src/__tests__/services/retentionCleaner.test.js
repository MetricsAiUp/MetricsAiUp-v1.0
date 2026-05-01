import { describe, it, expect, vi, beforeEach } from 'vitest';

// Тесты для retentionCleaner.js. Реплицируем чистую логику + тестируем
// совокупный runOnce через mock prisma.

// ── Реплики из retentionCleaner.js ──

function daysAgo(days, now = Date.now()) {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

// Pure-skeleton каждой clean-функции: получаем prisma + days/keep, возвращаем count.
function makeCleaners(prisma) {
  async function cleanMonitoringSnapshots(days) {
    if (!days) return 0;
    const cutoff = daysAgo(days);
    const res = await prisma.monitoringSnapshot.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    return res.count;
  }
  async function cleanAuditLogs(days) {
    if (!days) return 0;
    const cutoff = daysAgo(days);
    const res = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return res.count;
  }
  async function cleanEvents(days) {
    if (!days) return 0;
    const cutoff = daysAgo(days);
    const res = await prisma.event.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return res.count;
  }
  async function cleanSyncLogs(keep) {
    if (!keep) return 0;
    const total = await prisma.syncLog.count();
    if (total <= keep) return 0;
    const cutoffRow = await prisma.syncLog.findMany({
      orderBy: { createdAt: 'desc' }, skip: keep, take: 1, select: { createdAt: true },
    });
    if (!cutoffRow.length) return 0;
    const res = await prisma.syncLog.deleteMany({
      where: { createdAt: { lt: cutoffRow[0].createdAt } },
    });
    return res.count;
  }
  async function cleanRecommendations(days) {
    if (!days) return 0;
    const cutoff = daysAgo(days);
    const res = await prisma.recommendation.deleteMany({
      where: {
        status: { in: ['resolved', 'acknowledged'] },
        updatedAt: { lt: cutoff },
      },
    });
    return res.count;
  }
  return {
    cleanMonitoringSnapshots, cleanAuditLogs, cleanEvents,
    cleanSyncLogs, cleanRecommendations,
  };
}

function makeMockPrisma() {
  return {
    monitoringSnapshot: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    event: { deleteMany: vi.fn() },
    syncLog: {
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    recommendation: { deleteMany: vi.fn() },
  };
}

describe('retentionCleaner - daysAgo', () => {
  it('returns date N days before reference', () => {
    const now = new Date('2026-05-10T12:00:00Z').getTime();
    expect(daysAgo(7, now).toISOString()).toBe('2026-05-03T12:00:00.000Z');
  });

  it('returns reference for 0 days', () => {
    const now = new Date('2026-05-10T12:00:00Z').getTime();
    expect(daysAgo(0, now).getTime()).toBe(now);
  });

  it('handles fractional days', () => {
    const now = new Date('2026-05-10T12:00:00Z').getTime();
    // 0.5 days = 12 hours
    expect(daysAgo(0.5, now).toISOString()).toBe('2026-05-10T00:00:00.000Z');
  });
});

describe('retentionCleaner - cleaner functions', () => {
  let prisma, cleaners;
  beforeEach(() => {
    prisma = makeMockPrisma();
    cleaners = makeCleaners(prisma);
  });

  it('cleanMonitoringSnapshots returns 0 when days=0 (disabled)', async () => {
    expect(await cleaners.cleanMonitoringSnapshots(0)).toBe(0);
    expect(prisma.monitoringSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it('cleanMonitoringSnapshots calls deleteMany with timestamp cutoff', async () => {
    prisma.monitoringSnapshot.deleteMany.mockResolvedValue({ count: 42 });
    const out = await cleaners.cleanMonitoringSnapshots(30);
    expect(out).toBe(42);
    const arg = prisma.monitoringSnapshot.deleteMany.mock.calls[0][0];
    expect(arg.where.timestamp.lt).toBeInstanceOf(Date);
  });

  it('cleanAuditLogs / cleanEvents use createdAt cutoff', async () => {
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });
    prisma.event.deleteMany.mockResolvedValue({ count: 9 });
    expect(await cleaners.cleanAuditLogs(14)).toBe(5);
    expect(await cleaners.cleanEvents(7)).toBe(9);
    expect(prisma.auditLog.deleteMany.mock.calls[0][0].where.createdAt.lt).toBeInstanceOf(Date);
    expect(prisma.event.deleteMany.mock.calls[0][0].where.createdAt.lt).toBeInstanceOf(Date);
  });

  it('cleanRecommendations filters status in (resolved, acknowledged)', async () => {
    prisma.recommendation.deleteMany.mockResolvedValue({ count: 3 });
    await cleaners.cleanRecommendations(30);
    const arg = prisma.recommendation.deleteMany.mock.calls[0][0];
    expect(arg.where.status.in).toEqual(['resolved', 'acknowledged']);
  });
});

describe('retentionCleaner - cleanSyncLogs', () => {
  let prisma, cleaners;
  beforeEach(() => {
    prisma = makeMockPrisma();
    cleaners = makeCleaners(prisma);
  });

  it('returns 0 when keep=0', async () => {
    expect(await cleaners.cleanSyncLogs(0)).toBe(0);
    expect(prisma.syncLog.count).not.toHaveBeenCalled();
  });

  it('returns 0 when total <= keep', async () => {
    prisma.syncLog.count.mockResolvedValue(50);
    expect(await cleaners.cleanSyncLogs(100)).toBe(0);
    expect(prisma.syncLog.findMany).not.toHaveBeenCalled();
  });

  it('returns 0 when cutoffRow is empty', async () => {
    prisma.syncLog.count.mockResolvedValue(150);
    prisma.syncLog.findMany.mockResolvedValue([]);
    expect(await cleaners.cleanSyncLogs(100)).toBe(0);
  });

  it('deletes everything older than the (keep+1)-th newest entry', async () => {
    prisma.syncLog.count.mockResolvedValue(150);
    const cutoffDate = new Date('2026-04-01T00:00:00Z');
    prisma.syncLog.findMany.mockResolvedValue([{ createdAt: cutoffDate }]);
    prisma.syncLog.deleteMany.mockResolvedValue({ count: 50 });
    const out = await cleaners.cleanSyncLogs(100);
    expect(out).toBe(50);
    const findArgs = prisma.syncLog.findMany.mock.calls[0][0];
    expect(findArgs.skip).toBe(100);
    expect(findArgs.take).toBe(1);
    const delArgs = prisma.syncLog.deleteMany.mock.calls[0][0];
    expect(delArgs.where.createdAt.lt).toBe(cutoffDate);
  });
});
