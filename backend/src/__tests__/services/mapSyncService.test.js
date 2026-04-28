import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const prisma = require('../../config/database');

const spies = {};

function setupSpies() {
  spies.postFindUnique = vi.spyOn(prisma.post, 'findUnique');
  spies.postUpdate = vi.spyOn(prisma.post, 'update');
  spies.postCreate = vi.spyOn(prisma.post, 'create');
  spies.postUpdateMany = vi.spyOn(prisma.post, 'updateMany');

  spies.zoneFindFirst = vi.spyOn(prisma.zone, 'findFirst');
  spies.zoneCreate = vi.spyOn(prisma.zone, 'create');
  spies.zoneUpdate = vi.spyOn(prisma.zone, 'update');
  spies.zoneUpdateMany = vi.spyOn(prisma.zone, 'updateMany');

  spies.cameraFindFirst = vi.spyOn(prisma.camera, 'findFirst');
  spies.cameraCreate = vi.spyOn(prisma.camera, 'create');
  spies.cameraUpdate = vi.spyOn(prisma.camera, 'update');
  spies.cameraUpdateMany = vi.spyOn(prisma.camera, 'updateMany');
}

setupSpies();

const {
  syncMapLayoutToEntities,
  parseElements,
  getPostNumber,
} = require('../../services/mapSyncService');

describe('mapSyncService — pure helpers', () => {
  describe('getPostNumber', () => {
    it('returns null for non-post elements', () => {
      expect(getPostNumber({ type: 'zone', number: 5 })).toBeNull();
      expect(getPostNumber(null)).toBeNull();
    });

    it('uses el.number when present', () => {
      expect(getPostNumber({ type: 'post', number: 7 })).toBe(7);
    });

    it('falls back to digits in el.name', () => {
      expect(getPostNumber({ type: 'post', name: 'Пост 04' })).toBe(4);
      expect(getPostNumber({ type: 'post', name: 'Кузовной 11' })).toBe(11);
    });

    it('falls back to numeric el.id', () => {
      expect(getPostNumber({ type: 'post', id: '12' })).toBe(12);
    });

    it('returns null when nothing parseable', () => {
      expect(getPostNumber({ type: 'post', name: 'no number here', id: 'abc' })).toBeNull();
    });

    it('rejects non-positive numbers', () => {
      expect(getPostNumber({ type: 'post', number: 0 })).toBeNull();
      expect(getPostNumber({ type: 'post', number: -3 })).toBeNull();
    });
  });

  describe('parseElements', () => {
    it('returns array as-is', () => {
      const arr = [{ id: 1 }, { id: 2 }];
      expect(parseElements({ elements: arr })).toEqual(arr);
    });

    it('parses JSON string', () => {
      expect(parseElements({ elements: '[{"id":1}]' })).toEqual([{ id: 1 }]);
    });

    it('returns empty array for null/invalid', () => {
      expect(parseElements(null)).toEqual([]);
      expect(parseElements({ elements: 'not json' })).toEqual([]);
      expect(parseElements({ elements: undefined })).toEqual([]);
    });
  });
});

describe('mapSyncService — syncMapLayoutToEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    spies.postFindUnique.mockResolvedValue(null);
    spies.postCreate.mockResolvedValue({});
    spies.postUpdate.mockResolvedValue({});
    spies.postUpdateMany.mockResolvedValue({ count: 0 });

    spies.zoneFindFirst.mockResolvedValue(null);
    spies.zoneCreate.mockResolvedValue({ id: 'z1', name: 'Zone1' });
    spies.zoneUpdate.mockResolvedValue({});
    spies.zoneUpdateMany.mockResolvedValue({ count: 0 });

    spies.cameraFindFirst.mockResolvedValue(null);
    spies.cameraCreate.mockResolvedValue({});
    spies.cameraUpdate.mockResolvedValue({});
    spies.cameraUpdateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setupSpies();
  });

  it('creates new zone, post, camera when layout has them and DB is empty', async () => {
    const layout = {
      elements: [
        { type: 'zone', name: 'Зона А', label: 'Зона А', labelEn: 'Zone A', zoneType: 'repair' },
        { type: 'post', number: 1, label: 'Кузовной', labelEn: 'Body', postType: 'heavy' },
        { type: 'camera', name: 'cam01', rtspUrl: 'rtsp://x' },
      ],
    };

    // For post create — fallbackZone resolves to created zone
    spies.zoneFindFirst.mockResolvedValueOnce(null); // first call (existing search by name)
    spies.zoneFindFirst.mockResolvedValueOnce({ id: 'z1', name: 'Зона А' }); // ensureFallbackZone

    const summary = await syncMapLayoutToEntities(layout);

    expect(spies.zoneCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Зона А', type: 'repair', displayName: 'Зона А', displayNameEn: 'Zone A' }),
    }));
    expect(spies.postCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        number: 1,
        type: 'heavy',
        displayName: 'Кузовной',
        displayNameEn: 'Body',
      }),
    }));
    expect(spies.cameraCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'cam01', rtspUrl: 'rtsp://x' }),
    }));

    expect(summary.zones.created).toBe(1);
    expect(summary.posts.created).toBe(1);
    expect(summary.cameras.created).toBe(1);
  });

  it('updates existing post and restores when previously soft-deleted', async () => {
    spies.postFindUnique.mockResolvedValueOnce({ id: 'p1', number: 5, deleted: true });
    spies.zoneFindFirst.mockResolvedValueOnce({ id: 'z1' }); // not used here but kept safe

    const layout = {
      elements: [
        { type: 'post', number: 5, label: 'Пост 5', postType: 'light' },
      ],
    };

    const summary = await syncMapLayoutToEntities(layout);

    expect(spies.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { number: 5 },
      data: expect.objectContaining({ deleted: false, deletedAt: null, displayName: 'Пост 5', type: 'light' }),
    }));
    expect(summary.posts.restored).toBe(1);
    expect(summary.posts.updated).toBe(0);
  });

  it('soft-deletes posts/zones/cameras not present in layout', async () => {
    spies.postUpdateMany.mockResolvedValueOnce({ count: 3 });
    spies.zoneUpdateMany.mockResolvedValueOnce({ count: 2 });
    spies.cameraUpdateMany.mockResolvedValueOnce({ count: 1 });

    const summary = await syncMapLayoutToEntities({ elements: [] });

    expect(spies.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        number: { not: null, notIn: [] },
        deleted: false,
      }),
      data: expect.objectContaining({ deleted: true }),
    }));
    expect(summary.posts.softDeleted).toBe(3);
    expect(summary.zones.softDeleted).toBe(2);
    expect(summary.cameras.softDeleted).toBe(1);
  });

  it('deduplicates posts with same number', async () => {
    const layout = {
      elements: [
        { type: 'post', number: 1, label: 'A' },
        { type: 'post', number: 1, label: 'B' },
      ],
    };

    spies.zoneFindFirst.mockResolvedValueOnce(null);
    spies.zoneFindFirst.mockResolvedValueOnce({ id: 'z1' }); // fallbackZone

    await syncMapLayoutToEntities(layout);

    // Only one create call, not two
    expect(spies.postCreate).toHaveBeenCalledTimes(1);
  });

  it('skips posts without identifiable number', async () => {
    const layout = {
      elements: [{ type: 'post', name: 'no digits', id: 'abc' }],
    };

    await syncMapLayoutToEntities(layout);

    expect(spies.postCreate).not.toHaveBeenCalled();
    expect(spies.postUpdate).not.toHaveBeenCalled();
  });
});
