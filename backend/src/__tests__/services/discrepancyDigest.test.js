import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const telegramBot = require('../../services/telegramBot');

const spies = {};
function setupSpies() {
  spies.findMany = vi.spyOn(prisma.discrepancy, 'findMany');
  spies.count = vi.spyOn(prisma.discrepancy, 'count');
  spies.postFindMany = vi.spyOn(prisma.post, 'findMany');
  spies.broadcast = vi.spyOn(telegramBot, 'broadcastTelegram').mockResolvedValue(undefined);
  if (telegramBot.sendTelegramNotification) {
    spies.send = vi.spyOn(telegramBot, 'sendTelegramNotification').mockResolvedValue(undefined);
  }
}
setupSpies();

const digest = require('../../services/discrepancyDigest');

describe('services/discrepancyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSpies();
  });

  describe('buildReport', () => {
    it('пустой набор → отчёт с нулями', async () => {
      spies.findMany.mockResolvedValueOnce([]);
      spies.count.mockResolvedValueOnce(0);
      const r = await digest.buildReport({ from: new Date('2026-05-05'), to: new Date('2026-05-06') });
      expect(r.counts.detected).toBe(0);
      expect(r.counts.open).toBe(0);
      expect(r.text).toContain('Всего обнаружено за сутки: 0');
      expect(r.text).toContain('Открытых на текущий момент: 0');
    });

    it('считает по severity и типу', async () => {
      spies.findMany.mockResolvedValueOnce([
        { id: 'd1', type: 'no_show_in_cv', severity: 'critical', postId: 'p1', orderNumber: 'ЗН-1' },
        { id: 'd2', type: 'no_show_in_cv', severity: 'critical', postId: 'p1', orderNumber: 'ЗН-2' },
        { id: 'd3', type: 'wrong_post', severity: 'warning', postId: 'p2', orderNumber: 'ЗН-3' },
      ]);
      spies.count.mockResolvedValueOnce(5);
      spies.postFindMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Post 1', number: 1 },
        { id: 'p2', name: 'Post 2', number: 2 },
      ]);

      const r = await digest.buildReport({ from: new Date('2026-05-05'), to: new Date('2026-05-06') });

      expect(r.counts.detected).toBe(3);
      expect(r.counts.open).toBe(5);
      expect(r.counts.bySeverity).toEqual({ critical: 2, warning: 1, info: 0 });
      expect(r.counts.byType).toEqual({ no_show_in_cv: 2, wrong_post: 1 });
      expect(r.text).toContain('critical: 2');
      expect(r.text).toContain('warning:  1');
      expect(r.text).toContain('Нет визита по CV: 2');
      expect(r.text).toContain('Неверный пост: 1');
    });

    it('включает топ-3 постов', async () => {
      const detected = [
        ...Array(3).fill({ id: 'x', type: 'no_show_in_cv', severity: 'critical', postId: 'p1', orderNumber: '1' }),
        ...Array(2).fill({ id: 'x', type: 'wrong_post', severity: 'warning', postId: 'p2', orderNumber: '2' }),
        { id: 'x', type: 'time_mismatch', severity: 'warning', postId: 'p3', orderNumber: '3' },
        { id: 'x', type: 'time_mismatch', severity: 'warning', postId: 'p4', orderNumber: '4' },
      ];
      spies.findMany.mockResolvedValueOnce(detected);
      spies.count.mockResolvedValueOnce(0);
      spies.postFindMany.mockResolvedValueOnce([
        { id: 'p1', number: 1 },
        { id: 'p2', number: 2 },
        { id: 'p3', number: 3 },
      ]);
      const r = await digest.buildReport({ from: new Date('2026-05-05'), to: new Date('2026-05-06') });
      expect(r.text).toContain('Топ постов');
      expect(r.text).toContain('Пост 1: 3');
      expect(r.text).toContain('Пост 2: 2');
      // p4 не попадает в топ-3
      expect(r.text).not.toContain('Пост 4');
    });
  });

  describe('runOnce', () => {
    it('зовёт buildReport за последние 24ч и broadcastTelegram', async () => {
      spies.findMany.mockResolvedValueOnce([]);
      spies.count.mockResolvedValueOnce(0);
      const fixedNow = new Date('2026-05-06T09:00:00Z');
      const r = await digest.runOnce({ now: fixedNow });
      expect(r.counts.detected).toBe(0);
      expect(spies.broadcast).toHaveBeenCalledOnce();
      const txt = spies.broadcast.mock.calls[0][0];
      expect(txt).toContain('Дайджест');
    });

    it('падение Telegram не ломает digest', async () => {
      spies.findMany.mockResolvedValueOnce([]);
      spies.count.mockResolvedValueOnce(0);
      spies.broadcast.mockRejectedValueOnce(new Error('TG down'));
      await expect(digest.runOnce({ now: new Date() })).resolves.toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('DISCREPANCY_DIGEST_DISABLED=1 → не стартует', () => {
      const prev = process.env.DISCREPANCY_DIGEST_DISABLED;
      process.env.DISCREPANCY_DIGEST_DISABLED = '1';
      digest.stop();
      expect(() => digest.start()).not.toThrow();
      digest.stop();
      process.env.DISCREPANCY_DIGEST_DISABLED = prev;
    });
  });
});
