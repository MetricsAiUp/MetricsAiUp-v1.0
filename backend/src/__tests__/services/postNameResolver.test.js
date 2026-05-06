import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');

const spies = {};
function setupSpies() {
  spies.postFindMany = vi.spyOn(prisma.post, 'findMany');
  spies.postFindUnique = vi.spyOn(prisma.post, 'findUnique');
  spies.unmappedFindMany = vi.spyOn(prisma.oneCUnmappedPost, 'findMany');
  spies.unmappedUpsert = vi.spyOn(prisma.oneCUnmappedPost, 'upsert');
}
setupSpies();

const resolver = require('../../services/postNameResolver');

describe('services/postNameResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSpies();
    resolver.resetCache();

    spies.postFindMany.mockResolvedValue([
      { id: 'p1', number: 1, externalAliases: null, isTracked: true },
      { id: 'p2', number: 2, externalAliases: JSON.stringify(['Кол(2-х ст >2,5т) ПОСТ-2 спец']), isTracked: true },
      { id: 'p9', number: 9, externalAliases: null, isTracked: false },
    ]);
    spies.unmappedFindMany.mockResolvedValue([
      { rawName: 'Уже_размечено', resolved: true, resolvedPostId: 'p1', resolvedAsNonTracked: false },
      { rawName: 'Не_наш_пост', resolved: true, resolvedPostId: null, resolvedAsNonTracked: true },
    ]);
    spies.unmappedUpsert.mockResolvedValue({ id: 1 });
  });

  describe('regex', () => {
    it('"ПОСТ 1 ..." → post.id=p1 (regex)', async () => {
      const r = await resolver.resolve('ПОСТ 1 Диагностика');
      expect(r).toEqual({ postId: 'p1', isTracked: true, source: 'regex' });
    });

    it('"Пост 9" (lowercase) → post.id=p9, isTracked=false', async () => {
      const r = await resolver.resolve('Пост 9 Спец');
      expect(r).toEqual({ postId: 'p9', isTracked: false, source: 'regex' });
    });

    it('"Post 2" (en) → post.id=p2', async () => {
      const r = await resolver.resolve('Post 2');
      expect(r.postId).toBe('p2');
      expect(r.source).toBe('regex');
    });

    it('"ПОСТ 99" — нет такого номера → fallback на unmapped', async () => {
      const r = await resolver.resolve('ПОСТ 99');
      expect(r.postId).toBeNull();
      expect(r.source).toBe('unmapped');
      expect(spies.unmappedUpsert).toHaveBeenCalledOnce();
    });
  });

  describe('alias', () => {
    it('точное совпадение по externalAliases → post.id=p2', async () => {
      const r = await resolver.resolve('Кол(2-х ст >2,5т) ПОСТ-2 спец');
      // regex не сработает (нет "ПОСТ N\b" в начале), но alias сработает
      expect(r.postId).toBe('p2');
      expect(r.source).toBe('alias');
    });
  });

  describe('manual (resolved unmapped)', () => {
    it('rawName уже разрешён в OneCUnmappedPost → возвращает postId', async () => {
      spies.postFindUnique.mockResolvedValueOnce({ id: 'p1', isTracked: true });
      const r = await resolver.resolve('Уже_размечено');
      expect(r).toEqual({ postId: 'p1', isTracked: true, source: 'manual' });
    });

    it('resolvedAsNonTracked=true → postId=null, isTracked=false, не наш пост', async () => {
      const r = await resolver.resolve('Не_наш_пост');
      expect(r).toEqual({ postId: null, isTracked: false, source: 'manual' });
    });
  });

  describe('unmapped (новое имя)', () => {
    it('новое сырое имя → upsert + occurrences++', async () => {
      const r = await resolver.resolve('Какое-то странное место');
      expect(r.postId).toBeNull();
      expect(r.source).toBe('unmapped');
      expect(spies.unmappedUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rawName: 'Какое-то странное место' },
          update: expect.objectContaining({ occurrences: { increment: 1 } }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('пустая строка → invalid', async () => {
      const r = await resolver.resolve('');
      expect(r).toEqual({ postId: null, isTracked: true, source: 'invalid' });
    });

    it('null → invalid (без падения)', async () => {
      const r = await resolver.resolve(null);
      expect(r.source).toBe('invalid');
    });

    it('пробелы вокруг — trim() работает', async () => {
      const r = await resolver.resolve('  ПОСТ 1  ');
      expect(r.postId).toBe('p1');
    });
  });

  describe('resetCache', () => {
    it('после resetCache loadCaches вызывается снова', async () => {
      await resolver.resolve('ПОСТ 1');
      await resolver.resolve('ПОСТ 2');
      expect(spies.postFindMany).toHaveBeenCalledOnce();

      resolver.resetCache();
      await resolver.resolve('ПОСТ 1');
      expect(spies.postFindMany).toHaveBeenCalledTimes(2);
    });
  });
});
