import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');

const spies = {};
function setupSpies() {
  spies.imapCfg = vi.spyOn(prisma.imap1CConfig, 'findUnique');
  spies.sessionFindMany = vi.spyOn(prisma.vehicleSession, 'findMany');
  spies.stayFindMany = vi.spyOn(prisma.postStay, 'findMany');
  spies.matchUpsert = vi.spyOn(prisma.oneCCvMatch, 'upsert');
  spies.matchFindFirst = vi.spyOn(prisma.oneCCvMatch, 'findFirst');
  spies.matchCreate = vi.spyOn(prisma.oneCCvMatch, 'create');
  spies.matchUpdate = vi.spyOn(prisma.oneCCvMatch, 'update');
}
setupSpies();

const matcher = require('../../services/oneCCvMatcher');

describe('services/oneCCvMatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSpies();
    spies.imapCfg.mockResolvedValue({ matchWindowHours: 24 });
  });

  describe('normalizePlate', () => {
    it('upper + удаляет пробелы/дефисы/точки', () => {
      expect(matcher.normalizePlate('a 123 bb-77')).toBe('A123BB77');
      expect(matcher.normalizePlate('А.123.ББ.77')).toBe('А123ББ77');
    });
    it('null → null', () => {
      expect(matcher.normalizePlate(null)).toBeNull();
      expect(matcher.normalizePlate('')).toBeNull();
    });
  });

  describe('levenshtein', () => {
    it('равные строки → 0', () => {
      expect(matcher.levenshtein('abc', 'abc')).toBe(0);
    });
    it('1 замена', () => {
      expect(matcher.levenshtein('abc', 'aXc')).toBe(1);
    });
    it('пустая строка', () => {
      expect(matcher.levenshtein('', 'abc')).toBe(3);
      expect(matcher.levenshtein('abc', '')).toBe(3);
    });
    it('ранний выход при разнице длин > max', () => {
      expect(matcher.levenshtein('a', 'abcdef', 2)).toBe(3);
    });
  });

  describe('findMatch', () => {
    const order = {
      orderNumber: 'ЗН-001',
      vin: null,
      plateNumber: 'А123ББ77',
      scheduledStart: new Date('2026-05-06T10:00:00Z'),
    };

    it('точный матч по plate → matchType=exact_plate, conf=0.9', async () => {
      const session = { id: 's1', plateNumber: 'А123ББ77', entryTime: new Date('2026-05-06T10:05:00Z'), createdAt: new Date() };
      spies.sessionFindMany.mockResolvedValueOnce([session]);
      const m = await matcher.findMatch(order);
      expect(m).toEqual({ session, matchType: 'exact_plate', confidence: 0.9, windowApplied: false });
    });

    it('plate с пробелами/дефисами нормализуется', async () => {
      const session = { id: 's1', plateNumber: 'а 123 бб-77', entryTime: new Date('2026-05-06T10:05:00Z'), createdAt: new Date() };
      spies.sessionFindMany.mockResolvedValueOnce([session]);
      const m = await matcher.findMatch(order);
      expect(m.matchType).toBe('exact_plate');
      expect(m.session).toBe(session);
    });

    it('два exact-кандидата → tie-break по близости anchor', async () => {
      const closer = { id: 'closer', plateNumber: 'А123ББ77', entryTime: new Date('2026-05-06T10:05:00Z'), createdAt: new Date() };
      const farther = { id: 'farther', plateNumber: 'А123ББ77', entryTime: new Date('2026-05-06T18:00:00Z'), createdAt: new Date() };
      spies.sessionFindMany.mockResolvedValueOnce([farther, closer]);
      const m = await matcher.findMatch(order);
      expect(m.matchType).toBe('exact_plate');
      expect(m.session).toBe(closer);
      expect(m.windowApplied).toBe(true);
    });

    it('fuzzy: одна буква отличается → fuzzy_plate, conf=0.55', async () => {
      // exact пусто
      spies.sessionFindMany.mockResolvedValueOnce([]);
      // fuzzy в окне
      const session = { id: 'f1', plateNumber: 'А123ВВ77', entryTime: new Date('2026-05-06T10:05:00Z'), createdAt: new Date() };
      spies.sessionFindMany.mockResolvedValueOnce([session]);
      const m = await matcher.findMatch(order);
      expect(m.matchType).toBe('fuzzy_plate');
      expect(m.confidence).toBe(0.55);
      expect(m.session).toBe(session);
    });

    it('fuzzy: расстояние > 2 → не матч', async () => {
      spies.sessionFindMany.mockResolvedValueOnce([]); // exact
      spies.sessionFindMany.mockResolvedValueOnce([
        { id: 'far', plateNumber: 'XXXXXX99', entryTime: new Date('2026-05-06T10:05:00Z'), createdAt: new Date() },
      ]);
      const m = await matcher.findMatch(order);
      expect(m.matchType).toBe('none');
      expect(m.session).toBeNull();
    });

    it('plate=null → matchType=none', async () => {
      const m = await matcher.findMatch({ ...order, plateNumber: null });
      expect(m.matchType).toBe('none');
      expect(spies.sessionFindMany).not.toHaveBeenCalled();
    });

    it('matchWindowHours из конфига применяется к fuzzy', async () => {
      spies.imapCfg.mockResolvedValueOnce({ matchWindowHours: 1 });
      spies.sessionFindMany.mockResolvedValueOnce([]); // exact
      spies.sessionFindMany.mockResolvedValueOnce([]); // fuzzy
      await matcher.findMatch(order);
      const call = spies.sessionFindMany.mock.calls[1][0];
      const win = call.where.entryTime;
      // Окно 1 час = 2 часа диапазон
      expect(win.lte.getTime() - win.gte.getTime()).toBe(2 * 60 * 60 * 1000);
    });
  });

  describe('persistMatch', () => {
    it('match с session → upsert по составному ключу', async () => {
      spies.matchUpsert.mockResolvedValueOnce({ id: 'm1' });
      await matcher.persistMatch(
        { orderNumber: 'ЗН-001' },
        { session: { id: 's1' }, matchType: 'exact_plate', confidence: 0.9, windowApplied: false }
      );
      expect(spies.matchUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderNumber_vehicleSessionId: { orderNumber: 'ЗН-001', vehicleSessionId: 's1' } },
        })
      );
    });

    it('match без session → проверка существования + create/update', async () => {
      spies.matchFindFirst.mockResolvedValueOnce(null);
      spies.matchCreate.mockResolvedValueOnce({ id: 'm2' });
      await matcher.persistMatch(
        { orderNumber: 'ЗН-002' },
        { session: null, matchType: 'none', confidence: 0, windowApplied: false }
      );
      expect(spies.matchCreate).toHaveBeenCalledOnce();
    });

    it('match без session, существующая запись → update timestamp', async () => {
      spies.matchFindFirst.mockResolvedValueOnce({ id: 'old' });
      spies.matchUpdate.mockResolvedValueOnce({ id: 'old' });
      await matcher.persistMatch(
        { orderNumber: 'ЗН-002' },
        { session: null, matchType: 'none', confidence: 0, windowApplied: false }
      );
      expect(spies.matchUpdate).toHaveBeenCalledOnce();
      expect(spies.matchCreate).not.toHaveBeenCalled();
    });
  });

  describe('findPostStayForSession', () => {
    it('пустой stays → null', async () => {
      spies.stayFindMany.mockResolvedValueOnce([]);
      const r = await matcher.findPostStayForSession('s1', new Date(), 1000);
      expect(r).toBeNull();
    });

    it('один stay → возвращает его', async () => {
      const stay = { id: 'st1', postId: 'p1', startTime: new Date('2026-05-06T10:00:00Z') };
      spies.stayFindMany.mockResolvedValueOnce([stay]);
      const r = await matcher.findPostStayForSession('s1', new Date('2026-05-06T11:00:00Z'), 24 * 3600 * 1000);
      expect(r).toBe(stay);
    });

    it('несколько stays → ближайший к anchor в окне', async () => {
      const close = { id: 'st1', postId: 'p1', startTime: new Date('2026-05-06T10:30:00Z') };
      const far = { id: 'st2', postId: 'p2', startTime: new Date('2026-05-06T20:00:00Z') };
      spies.stayFindMany.mockResolvedValueOnce([far, close]);
      const r = await matcher.findPostStayForSession('s1', new Date('2026-05-06T10:00:00Z'), 24 * 3600 * 1000);
      expect(r).toBe(close);
    });
  });
});
