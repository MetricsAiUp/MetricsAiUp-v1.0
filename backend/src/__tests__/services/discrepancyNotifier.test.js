import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const telegramBot = require('../../services/telegramBot');
const notifier = require('../../services/discrepancyNotifier');

describe('discrepancyNotifier — _formatDiscrepancyForTelegram()', () => {
  const fmt = notifier._formatDiscrepancyForTelegram;
  it('renders critical with rocket icon and known type label', () => {
    const out = fmt({
      type: 'no_show_in_cv',
      severity: 'critical',
      orderNumber: 'WO-1',
      plateNumber: 'A100',
      description: 'desc',
    });
    expect(out).toMatch(/🚨/);
    expect(out).toMatch(/Нестыковка: Нет визита по CV/);
    expect(out).toMatch(/WO-1/);
    expect(out).toMatch(/A100/);
    expect(out).toMatch(/Severity:.+critical/);
    expect(out).toMatch(/desc/);
  });
  it('renders warning with triangle and falls back to raw type', () => {
    const out = fmt({ type: 'unknown_type', severity: 'warning', description: 'd' });
    expect(out).toMatch(/⚠️/);
    expect(out).toMatch(/unknown_type/);
  });
  it('renders info with i icon', () => {
    const out = fmt({ type: 'time_mismatch', severity: 'info', description: 'd' });
    expect(out).toMatch(/ℹ️/);
  });
  it('omits optional lines when fields absent', () => {
    const out = fmt({ type: 'time_mismatch', severity: 'warning', description: 'd' });
    expect(out).not.toMatch(/Заказ-наряд:/);
    expect(out).not.toMatch(/Номер:/);
  });
});

describe('discrepancyNotifier — notify()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(telegramBot, 'broadcastTelegram').mockResolvedValue();
    if (!prisma.pushSubscription) prisma.pushSubscription = {};
    vi.spyOn(prisma.pushSubscription, 'findMany').mockResolvedValue([]);
  });

  it('no-op when discrepancy is falsy (does not crash)', async () => {
    await expect(notifier.notify(null)).resolves.toBeUndefined();
  });

  it('does not throw for warning severity (socket emit is fire-and-forget)', async () => {
    // Note: socket emit is swallowed via try/catch in emitSocket; we test
    // observable behavior — no exception escapes notify().
    await expect(notifier.notify({
      id: 'd1', type: 'time_mismatch', severity: 'warning', status: 'open',
      orderNumber: 'WO-1', description: 'desc', detectedAt: new Date(),
    })).resolves.toBeUndefined();
  });

  it('skips telegram broadcast for warning severity', async () => {
    await notifier.notify({ id: 'd1', type: 'time_mismatch', severity: 'warning', description: 'd' });
    expect(telegramBot.broadcastTelegram).not.toHaveBeenCalled();
  });

  it('broadcasts to telegram on critical severity', async () => {
    await notifier.notify({ id: 'd1', type: 'no_show_in_cv', severity: 'critical', description: 'critical issue', orderNumber: 'WO-1' });
    // Telegram call is fire-and-forget (Promise.allSettled), wait one tick
    await new Promise((r) => setImmediate(r));
    expect(telegramBot.broadcastTelegram).toHaveBeenCalledOnce();
    const msg = telegramBot.broadcastTelegram.mock.calls[0][0];
    expect(msg).not.toMatch(/<[^>]+>/); // HTML stripped
    expect(msg).toMatch(/critical issue/);
  });

  it('survives missing Socket.IO context without throwing', async () => {
    // Socket.IO is not initialized in test env — notifier.emitSocket should swallow this.
    await expect(
      notifier.notify({ id: 'd1', type: 'time_mismatch', severity: 'warning', description: 'd' })
    ).resolves.toBeUndefined();
  });
});
