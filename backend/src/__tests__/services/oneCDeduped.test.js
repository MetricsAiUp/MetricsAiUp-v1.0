import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const oneCDeduped = require('../../services/oneCDeduped');

describe('oneCDeduped — column lists are stable', () => {
  it('PLAN_DEDUP_COLS contains expected core fields', () => {
    expect(oneCDeduped.PLAN_DEDUP_COLS).toEqual(expect.arrayContaining([
      'document_text', 'organization', 'vehicle_text',
      'plate_number', 'vin', 'number',
      'scheduled_start', 'scheduled_end',
      'duration_sec', 'is_outdated',
    ]));
  });
  it('REPAIR_DEDUP_COLS contains expected core fields', () => {
    expect(oneCDeduped.REPAIR_DEDUP_COLS).toEqual(expect.arrayContaining([
      'vehicle_text', 'brand', 'model', 'plate_number_1', 'plate_number_2', 'vin',
      'order_number', 'state', 'repair_kind',
      'work_started_at', 'work_finished_at', 'closed_at',
      'basis', 'basis_start', 'basis_end',
      'master', 'dispatcher',
    ]));
  });
  it('PERFORMED_DEDUP_COLS contains expected core fields', () => {
    expect(oneCDeduped.PERFORMED_DEDUP_COLS).toEqual(expect.arrayContaining([
      'order_number', 'norm_hours', 'cause_description', 'executor',
    ]));
  });
});

describe('oneCDeduped — getDedupedPlanRows()', () => {
  let spy;
  beforeEach(() => {
    spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([]);
  });
  afterEach?.(() => spy?.mockRestore());

  it('camelizes keys, drops rn, converts bigint to number', async () => {
    spy.mockResolvedValueOnce([
      { document_text: 'doc1', plate_number: 'A100', duration_sec: 3600n, rn: 1 },
      { document_text: 'doc2', plate_number: null, duration_sec: 0, rn: 1 },
    ]);
    const rows = await oneCDeduped.getDedupedPlanRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ documentText: 'doc1', plateNumber: 'A100', durationSec: 3600 });
    expect(rows[0].rn).toBeUndefined();
    expect(rows[1].plateNumber).toBeNull();
  });
  it('uses UI filter for document_type (plan/req only)', async () => {
    spy.mockResolvedValueOnce([]);
    await oneCDeduped.getDedupedPlanRows();
    const sql = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(sql).toMatch(/document_type IN \('План ремонта', 'Заявка на ремонт'\)/);
    expect(sql).toMatch(/FROM one_c_plan_rows/);
    expect(sql).toMatch(/PARTITION BY/);
    expect(sql).toMatch(/ORDER BY received_at DESC/);
    expect(sql).toMatch(/WHERE rn = 1/);
  });
});

describe('oneCDeduped — getDedupedRepairRows()', () => {
  let spy;
  beforeEach(() => {
    spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([]);
  });
  it('queries one_c_repair_snapshots without UI filter', async () => {
    await oneCDeduped.getDedupedRepairRows();
    const sql = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(sql).toMatch(/FROM one_c_repair_snapshots/);
    expect(sql).toMatch(/WHERE rn = 1/);
    expect(sql).not.toMatch(/document_type IN/);
  });
});

describe('oneCDeduped — getDedupedPerformedRows()', () => {
  let spy;
  beforeEach(() => {
    spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([]);
  });
  it('queries one_c_work_performed without UI filter', async () => {
    await oneCDeduped.getDedupedPerformedRows();
    const sql = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(sql).toMatch(/FROM one_c_work_performed/);
    expect(sql).not.toMatch(/document_type IN/);
  });
});
