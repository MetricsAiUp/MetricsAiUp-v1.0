import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const parser = require('../../services/oneCParser');
const postNameResolver = require('../../services/postNameResolver');
const merger = require('../../services/oneCMerger');
const importer = require('../../services/oneCImporter');

describe('oneCImporter — process()', () => {
  let importUpdateSpy, planCreateSpy, repairCreateSpy, performedCreateSpy;
  let detectSpy, parsePlanSpy, parseRepairSpy, parsePerformedSpy;
  let resolveSpy, mergeForImportSpy;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub prisma write methods on whatever models exist
    if (!prisma.oneCImport) prisma.oneCImport = {};
    if (!prisma.oneCPlanRow) prisma.oneCPlanRow = {};
    if (!prisma.oneCRepairSnapshot) prisma.oneCRepairSnapshot = {};
    if (!prisma.oneCWorkPerformed) prisma.oneCWorkPerformed = {};

    importUpdateSpy = vi.spyOn(prisma.oneCImport, 'update').mockResolvedValue({});
    planCreateSpy = vi.spyOn(prisma.oneCPlanRow, 'create').mockResolvedValue({});
    repairCreateSpy = vi.spyOn(prisma.oneCRepairSnapshot, 'create').mockResolvedValue({});
    performedCreateSpy = vi.spyOn(prisma.oneCWorkPerformed, 'create').mockResolvedValue({});

    // Stub parser internals
    vi.spyOn(parser, 'readWorkbook').mockReturnValue({ SheetNames: ['TDSheet'], Sheets: {} });
    detectSpy = vi.spyOn(parser, 'detectType');
    parsePlanSpy = vi.spyOn(parser, 'parsePlan');
    parseRepairSpy = vi.spyOn(parser, 'parseRepair');
    parsePerformedSpy = vi.spyOn(parser, 'parsePerformed');

    resolveSpy = vi.spyOn(postNameResolver, 'resolve').mockResolvedValue({ postId: 'p1' });
    mergeForImportSpy = vi.spyOn(merger, 'mergeForImport').mockResolvedValue();
  });

  function makeImportRecord(extra = {}) {
    return { id: 'imp-1', receivedAt: new Date('2026-04-14T07:00:00Z'), ...extra };
  }

  it('handles unknown format by marking import error_unknown_format', async () => {
    detectSpy.mockReturnValue('unknown');
    const result = await importer.process(makeImportRecord(), Buffer.from(''), {});
    expect(result).toEqual({ ok: false, reason: 'unknown_format' });
    expect(importUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ status: 'error_unknown_format', detectedType: 'unknown' }),
    }));
  });

  it('respects forceType=plan and inserts plan rows', async () => {
    parsePlanSpy.mockReturnValue([
      { number: 'P-1', plateNumber: 'A100', vin: 'V', scheduledStart: new Date(), scheduledEnd: new Date(), postRawName: 'Пост 1', durationSec: 100, isOutdated: false, documentText: 'doc' },
    ]);
    const result = await importer.process(makeImportRecord(), Buffer.from(''), { forceType: 'plan' });
    expect(result.ok).toBe(true);
    expect(result.type).toBe('plan');
    expect(result.rows).toBe(1);
    expect(result.inserted).toBe(1);
    expect(planCreateSpy).toHaveBeenCalledOnce();
    expect(resolveSpy).toHaveBeenCalledWith('Пост 1');
    expect(detectSpy).not.toHaveBeenCalled(); // forced — no auto-detect
  });

  it('inserts repair rows and accumulates affected orderNumbers', async () => {
    detectSpy.mockReturnValue('repair');
    parseRepairSpy.mockReturnValue([
      { orderNumber: 'WO-1', state: 'Закрыт', plateNumber1: 'A', vin: 'V' },
      { orderNumber: 'WO-1', state: 'Закрыт', plateNumber1: 'A', vin: 'V' }, // dup orderNumber
      { orderNumber: 'WO-2', state: 'В работе' },
    ]);
    const result = await importer.process(makeImportRecord(), Buffer.from(''), {});
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(3);
    expect(result.inserted).toBe(3);
    expect(repairCreateSpy).toHaveBeenCalledTimes(3);
    expect(new Set(result.affectedOrderNumbers)).toEqual(new Set(['WO-1', 'WO-2']));
  });

  it('inserts performed rows', async () => {
    detectSpy.mockReturnValue('performed');
    parsePerformedSpy.mockReturnValue([
      { orderNumber: 'K-1', state: 'Закрыт', executor: 'E', plateNumber: 'A', vin: 'V', normHours: 1 },
    ]);
    const result = await importer.process(makeImportRecord(), Buffer.from(''), {});
    expect(result.ok).toBe(true);
    expect(performedCreateSpy).toHaveBeenCalledOnce();
  });

  it('marks import success with rowsTotal and inserted, and triggers merger', async () => {
    detectSpy.mockReturnValue('plan');
    parsePlanSpy.mockReturnValue([
      { number: 'P-1', plateNumber: 'A', vin: 'V', scheduledStart: new Date(), scheduledEnd: new Date(), postRawName: 'Пост 1', durationSec: 0, isOutdated: false, documentText: 'doc' },
    ]);
    await importer.process(makeImportRecord(), Buffer.from(''), {});
    expect(importUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'success', detectedType: 'plan', rowsTotal: 1, rowsInserted: 1 }),
    }));
    // merger triggered via setImmediate — wait one tick
    await new Promise((r) => setImmediate(r));
    expect(mergeForImportSpy).toHaveBeenCalledWith('imp-1');
  });

  it('catches errors and marks import status=error', async () => {
    detectSpy.mockImplementation(() => { throw new Error('parse boom'); });
    const result = await importer.process(makeImportRecord(), Buffer.from(''), {});
    expect(result).toEqual({ ok: false, reason: 'error', error: 'parse boom' });
    expect(importUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'error', errorMessage: expect.stringContaining('parse boom') }),
    }));
  });
});
