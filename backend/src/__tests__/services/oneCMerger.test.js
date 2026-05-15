import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const merger = require('../../services/oneCMerger');

// Ensure prisma model stubs exist
function ensureModels() {
  if (!prisma.oneCPlanRow) prisma.oneCPlanRow = {};
  if (!prisma.oneCRepairSnapshot) prisma.oneCRepairSnapshot = {};
  if (!prisma.oneCWorkPerformed) prisma.oneCWorkPerformed = {};
  if (!prisma.oneCStageMerged) prisma.oneCStageMerged = {};
  if (!prisma.oneCWorkOrderMerged) prisma.oneCWorkOrderMerged = {};
  if (!prisma.oneCImport) prisma.oneCImport = {};
}

describe('oneCMerger — buildAggregateForOrder()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('returns null when no source rows exist', async () => {
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue(null);
    const agg = await merger.buildAggregateForOrder('WO-X');
    expect(agg).toBeNull();
  });

  it('prefers performed over repair over plan, sets flags, picks max receivedAt', async () => {
    const planAt = new Date('2026-04-10T00:00:00Z');
    const repairAt = new Date('2026-04-12T00:00:00Z');
    const performedAt = new Date('2026-04-14T00:00:00Z');
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue({
      orderNumber: 'WO-1', vin: 'VIN-P', state: 'Закрыт', master: 'M-perf',
      normHours: 2.5, executor: 'E1', receivedAt: performedAt,
    });
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue({
      orderNumber: 'WO-1', vin: 'VIN-R', plateNumber1: 'P-R',
      state: 'В работе', master: 'M-rep', receivedAt: repairAt,
    });
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue({
      number: 'WO-1', plateNumber: 'P-PLAN', vin: 'VIN-PL',
      documentType: 'Заказ-наряд', organization: 'ORG',
      receivedAt: planAt,
    });
    const agg = await merger.buildAggregateForOrder('WO-1');
    expect(agg.orderNumber).toBe('WO-1');
    expect(agg.vin).toBe('VIN-P'); // performed wins
    expect(agg.state).toBe('Закрыт'); // performed wins
    expect(agg.master).toBe('M-perf'); // performed wins
    expect(agg.plateNumber).toBe('P-R'); // performed has none → repair.plateNumber1 wins over plan
    expect(agg.documentType).toBe('Заказ-наряд');
    expect(agg.organization).toBe('ORG');
    expect(agg.inPlan).toBe(true);
    expect(agg.inRepair).toBe(true);
    expect(agg.inPerformed).toBe(true);
    expect(agg.receivedAt.toISOString()).toBe(performedAt.toISOString());
  });

  it('falls back to plan-only when no performed/repair present', async () => {
    const planAt = new Date('2026-04-10T00:00:00Z');
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue({
      number: 'WO-2', plateNumber: 'P', vin: 'V', receivedAt: planAt,
      scheduledStart: new Date('2026-04-14T08:00:00Z'),
    });
    const agg = await merger.buildAggregateForOrder('WO-2');
    expect(agg.inPlan).toBe(true);
    expect(agg.inRepair).toBe(false);
    expect(agg.inPerformed).toBe(false);
    expect(agg.scheduledStart.toISOString()).toBe('2026-04-14T08:00:00.000Z');
    expect(agg.receivedAt.toISOString()).toBe(planAt.toISOString());
  });
});

describe('oneCMerger — mergeWorkOrder()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('returns false when no aggregate exists', async () => {
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue(null);
    expect(await merger.mergeWorkOrder('NOPE')).toBe(false);
  });

  it('dedup: returns false when last merged hash equals new hash', async () => {
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue({
      number: 'WO-3', vin: 'V', plateNumber: 'P', receivedAt: new Date(),
    });
    // First call to capture the hash via create()
    let savedHash = null;
    vi.spyOn(prisma.oneCWorkOrderMerged, 'findFirst').mockResolvedValueOnce(null);
    const createSpy = vi.spyOn(prisma.oneCWorkOrderMerged, 'create')
      .mockImplementation(({ data }) => { savedHash = data.contentHash; return Promise.resolve(data); });
    expect(await merger.mergeWorkOrder('WO-3')).toBe(true);
    expect(createSpy).toHaveBeenCalledOnce();

    // Second call — return prior with same hash
    vi.spyOn(prisma.oneCWorkOrderMerged, 'findFirst').mockResolvedValueOnce({ contentHash: savedHash });
    expect(await merger.mergeWorkOrder('WO-3')).toBe(false);
    expect(createSpy).toHaveBeenCalledOnce(); // no new write
  });

  it('inserts when last hash differs', async () => {
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue({
      number: 'WO-4', vin: 'V', plateNumber: 'P', receivedAt: new Date(),
    });
    vi.spyOn(prisma.oneCWorkOrderMerged, 'findFirst').mockResolvedValue({ contentHash: 'OTHER' });
    const createSpy = vi.spyOn(prisma.oneCWorkOrderMerged, 'create').mockResolvedValue({});
    expect(await merger.mergeWorkOrder('WO-4')).toBe(true);
    expect(createSpy).toHaveBeenCalledOnce();
  });
});

describe('oneCMerger — mergeForImport()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('returns zeros when import record is missing', async () => {
    vi.spyOn(prisma.oneCImport, 'findUnique').mockResolvedValue(null);
    const out = await merger.mergeForImport('missing');
    expect(out).toEqual({ merged: 0, stages: 0 });
  });

  it('processes plan import: merges stages and work-orders', async () => {
    vi.spyOn(prisma.oneCImport, 'findUnique').mockResolvedValue({ detectedType: 'plan' });
    vi.spyOn(prisma.oneCPlanRow, 'findMany').mockResolvedValue([
      { number: 'WO-A', postRawName: 'Пост 1', scheduledStart: new Date(), scheduledEnd: new Date(), durationSec: 100, isOutdated: false, vin: 'V', plateNumber: 'P', receivedAt: new Date() },
      { number: 'WO-B', postRawName: 'Пост 2', scheduledStart: new Date(), scheduledEnd: new Date(), durationSec: 200, isOutdated: false, vin: 'V', plateNumber: 'P', receivedAt: new Date() },
    ]);
    vi.spyOn(prisma.oneCStageMerged, 'findFirst').mockResolvedValue(null);
    const stageCreateSpy = vi.spyOn(prisma.oneCStageMerged, 'create').mockResolvedValue({});
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockImplementation(({ where }) =>
      Promise.resolve({ number: where.number, receivedAt: new Date(), vin: 'V', plateNumber: 'P' }),
    );
    vi.spyOn(prisma.oneCWorkOrderMerged, 'findFirst').mockResolvedValue(null);
    const woCreateSpy = vi.spyOn(prisma.oneCWorkOrderMerged, 'create').mockResolvedValue({});

    const out = await merger.mergeForImport('imp-1');
    expect(out.stages).toBe(2);
    expect(out.merged).toBe(2);
    expect(stageCreateSpy).toHaveBeenCalledTimes(2);
    expect(woCreateSpy).toHaveBeenCalledTimes(2);
  });

  it('processes performed import: only work-orders, no stages', async () => {
    vi.spyOn(prisma.oneCImport, 'findUnique').mockResolvedValue({ detectedType: 'performed' });
    vi.spyOn(prisma.oneCWorkPerformed, 'findMany').mockResolvedValue([
      { orderNumber: 'K-1' }, { orderNumber: 'K-1' }, { orderNumber: 'K-2' },
    ]);
    vi.spyOn(prisma.oneCWorkPerformed, 'findFirst').mockImplementation(({ where }) =>
      Promise.resolve({ orderNumber: where.orderNumber, state: 'Закрыт', vin: 'V', receivedAt: new Date() }),
    );
    vi.spyOn(prisma.oneCRepairSnapshot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCPlanRow, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.oneCWorkOrderMerged, 'findFirst').mockResolvedValue(null);
    const woCreateSpy = vi.spyOn(prisma.oneCWorkOrderMerged, 'create').mockResolvedValue({});

    const out = await merger.mergeForImport('imp-2');
    expect(out.stages).toBe(0);
    expect(out.merged).toBe(2); // distinct orderNumbers
    expect(woCreateSpy).toHaveBeenCalledTimes(2);
  });
});

describe('oneCMerger — getWorkOrderCurrent / getStageCurrent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getWorkOrderCurrent runs window-function SQL and sanitizes bigints', async () => {
    const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([
      { order_number: 'WO-1', mileage: 10000n, rn: 1 },
    ]);
    const out = await merger.getWorkOrderCurrent({ take: 5 });
    expect(spy.mock.calls[0][0]).toMatch(/PARTITION BY order_number/);
    expect(spy.mock.calls[0][0]).toMatch(/WHERE rn = 1/);
    expect(spy.mock.calls[0][0]).toMatch(/LIMIT 5/);
    expect(out[0]).toEqual({ order_number: 'WO-1', mileage: 10000 });
    expect(out[0].rn).toBeUndefined();
  });

  it('getStageCurrent applies orderNumber filter when provided', async () => {
    const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([]);
    await merger.getStageCurrent({ orderNumber: 'WO-X', take: 10, skip: 5 });
    const [sql, ...params] = spy.mock.calls[0];
    expect(sql).toMatch(/PARTITION BY order_number, post_raw_name, scheduled_start/);
    expect(sql).toMatch(/WHERE order_number = \?/);
    expect(sql).toMatch(/LIMIT 10/);
    expect(sql).toMatch(/OFFSET 5/);
    expect(params).toEqual(['WO-X']);
  });

  it('getStageCurrent omits filter when orderNumber absent', async () => {
    const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([]);
    await merger.getStageCurrent();
    const sql = spy.mock.calls[0][0];
    expect(sql).not.toMatch(/WHERE order_number = \?/);
  });
});
