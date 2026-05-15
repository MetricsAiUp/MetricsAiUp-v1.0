import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');

describe('telegramBot — module without TELEGRAM_BOT_TOKEN', () => {
  let bot;
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TELEGRAM_BOT_TOKEN;
    bot = require('../../services/telegramBot');
  });

  it('initTelegramBot returns null without token', () => {
    expect(bot.initTelegramBot()).toBeNull();
  });

  it('broadcastTelegram is a no-op when bot is uninitialized', async () => {
    if (!prisma.telegramLink) prisma.telegramLink = {};
    const spy = vi.spyOn(prisma.telegramLink, 'findMany').mockResolvedValue([{ chatId: '1' }]);
    await expect(bot.broadcastTelegram('hello')).resolves.toBeUndefined();
    // bot is null → prisma was not even queried (early return)
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sendTelegramNotification is a no-op when bot is uninitialized', async () => {
    if (!prisma.telegramLink) prisma.telegramLink = {};
    const spy = vi.spyOn(prisma.telegramLink, 'findUnique').mockResolvedValue({ chatId: '1' });
    await expect(bot.sendTelegramNotification('u1', 'msg')).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sendTelegramDocument is a no-op when bot is uninitialized', async () => {
    await expect(bot.sendTelegramDocument('cid', Buffer.from(''), 'f.xlsx', 'c')).resolves.toBeUndefined();
  });

  it('broadcastDocument is a no-op when bot is uninitialized', async () => {
    if (!prisma.telegramLink) prisma.telegramLink = {};
    const spy = vi.spyOn(prisma.telegramLink, 'findMany').mockResolvedValue([{ chatId: '1' }]);
    await expect(bot.broadcastDocument(Buffer.from(''), 'f.xlsx', 'c')).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('exports expected API', () => {
    expect(typeof bot.initTelegramBot).toBe('function');
    expect(typeof bot.sendTelegramNotification).toBe('function');
    expect(typeof bot.broadcastTelegram).toBe('function');
    expect(typeof bot.sendTelegramDocument).toBe('function');
    expect(typeof bot.broadcastDocument).toBe('function');
  });
});
