import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const resolver = require('../../services/postNameResolver');
const rescanner = require('../../services/unmappedPostsRescanner');

function ensureModels() {
  if (!prisma.oneCUnmappedPost) prisma.oneCUnmappedPost = {};
  if (!prisma.oneCPlanRow) prisma.oneCPlanRow = {};
  if (!prisma.oneCStageMerged) prisma.oneCStageMerged = {};
}

describe('unmappedPostsRescanner — rescan()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
    if (resolver.resetCache) vi.spyOn(resolver, 'resetCache').mockImplementation(() => {});
    vi.spyOn(prisma.oneCPlanRow, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.oneCStageMerged, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.oneCUnmappedPost, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.oneCUnmappedPost, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.oneCUnmappedPost, 'update').mockResolvedValue({});
  });

  it('returns zero counts when nothing to scan', async () => {
    vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: null, source: 'unmapped' });
    const out = await rescanner.rescan();
    expect(out.scanned).toBe(0);
    expect(out.autoResolved).toBe(0);
    expect(out.newUnmapped).toBe(0);
    expect(typeof out.durationMs).toBe('number');
  });

  it('auto-resolves stuck unmapped rows that now resolve via regex/alias', async () => {
    prisma.oneCUnmappedPost.findMany.mockResolvedValue([
      { rawName: 'Пост 1' },
      { rawName: 'Workshop' },
    ]);
    vi.spyOn(resolver, 'resolve').mockImplementation((name) => {
      if (name === 'Пост 1') return Promise.resolve({ postId: 'p1', source: 'regex' });
      if (name === 'Workshop') return Promise.resolve({ postId: 'p2', source: 'alias' });
      return Promise.resolve({ postId: null, source: 'unmapped' });
    });
    const out = await rescanner.rescan();
    expect(out.autoResolved).toBe(2);
    expect(prisma.oneCUnmappedPost.update).toHaveBeenCalledTimes(2);
    expect(prisma.oneCUnmappedPost.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { rawName: 'Пост 1' },
      data: expect.objectContaining({
        resolved: true,
        resolvedPostId: 'p1',
        resolvedBy: 'auto:regex',
        resolvedAsNonTracked: false,
      }),
    }));
    expect(prisma.oneCUnmappedPost.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { rawName: 'Workshop' },
      data: expect.objectContaining({ resolvedBy: 'auto:alias' }),
    }));
  });

  it('does NOT mark resolved when resolver returns unmapped or manual', async () => {
    prisma.oneCUnmappedPost.findMany.mockResolvedValue([{ rawName: 'X' }, { rawName: 'Y' }]);
    vi.spyOn(resolver, 'resolve').mockImplementation((n) =>
      Promise.resolve(n === 'X'
        ? { postId: null, source: 'unmapped' }
        : { postId: 'p', source: 'manual' }),
    );
    const out = await rescanner.rescan();
    expect(out.autoResolved).toBe(0);
    expect(prisma.oneCUnmappedPost.update).not.toHaveBeenCalled();
  });

  it('collects distinct rawNames from plan + stage tables and calls resolver for each', async () => {
    prisma.oneCPlanRow.findMany.mockResolvedValue([
      { postRawName: 'Пост 1' }, { postRawName: 'Пост 2' }, { postRawName: null },
    ]);
    prisma.oneCStageMerged.findMany.mockResolvedValue([
      { postRawName: 'Пост 2' }, { postRawName: ' Пост 3 ' }, // dup + trim
    ]);
    const resolveSpy = vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: null, source: 'unmapped' });
    await rescanner.rescan();
    // 3 distinct rawNames passed to resolver
    const called = resolveSpy.mock.calls.map((c) => c[0]).sort();
    expect(called).toEqual(['Пост 1', 'Пост 2', 'Пост 3'].sort());
  });

  it('computes newUnmapped as delta of OneCUnmappedPost count', async () => {
    prisma.oneCPlanRow.findMany.mockResolvedValue([{ postRawName: 'NEW' }]);
    let count = 5;
    prisma.oneCUnmappedPost.count
      .mockImplementationOnce(() => Promise.resolve(count))
      .mockImplementationOnce(() => Promise.resolve(count + 2));
    vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: null, source: 'unmapped' });
    const out = await rescanner.rescan();
    expect(out.newUnmapped).toBe(2);
  });

  it('returns scanned = stuckCount + rawNamesCount', async () => {
    prisma.oneCUnmappedPost.findMany.mockResolvedValue([{ rawName: 'A' }, { rawName: 'B' }]);
    prisma.oneCPlanRow.findMany.mockResolvedValue([{ postRawName: 'C' }]);
    prisma.oneCStageMerged.findMany.mockResolvedValue([{ postRawName: 'D' }]);
    vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: null, source: 'unmapped' });
    const out = await rescanner.rescan();
    expect(out.scanned).toBe(4); // 2 stuck + 2 raw names
  });

  it('resets resolver cache before scanning', async () => {
    vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: null, source: 'unmapped' });
    await rescanner.rescan();
    expect(resolver.resetCache).toHaveBeenCalled();
  });

  it('survives socket emit failure when Socket.IO is unavailable', async () => {
    prisma.oneCUnmappedPost.findMany.mockResolvedValue([{ rawName: 'A' }]);
    vi.spyOn(resolver, 'resolve').mockResolvedValue({ postId: 'p1', source: 'regex' });
    // No need to mock socket — getIO() returns null in test env; we just need the call to not throw
    await expect(rescanner.rescan()).resolves.toBeDefined();
  });
});
