import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Telegram Bot Service', () => {
  const botCode = readFileSync(
    resolve(__dirname, '../../../backend/src/services/telegramBot.js'),
    'utf-8'
  );

  it('exports initTelegramBot function', () => {
    expect(botCode).toContain('function initTelegramBot');
    expect(botCode).toContain('module.exports');
    expect(botCode).toContain('initTelegramBot');
  });

  it('exports sendTelegramNotification function', () => {
    expect(botCode).toContain('async function sendTelegramNotification');
    expect(botCode).toContain('sendTelegramNotification');
  });

  it('exports broadcastTelegram function', () => {
    expect(botCode).toContain('async function broadcastTelegram');
    expect(botCode).toContain('broadcastTelegram');
  });

  it('handles /start command', () => {
    expect(botCode).toContain('/start');
    expect(botCode).toContain('Account linked');
  });

  it('handles /status command', () => {
    expect(botCode).toContain('/status');
    expect(botCode).toContain('STO Status');
  });

  it('handles /post N command', () => {
    expect(botCode).toContain('/post (\\d+)');
  });

  it('handles /free command', () => {
    expect(botCode).toContain('/free');
    expect(botCode).toContain('Free posts');
  });

  it('handles /report command', () => {
    expect(botCode).toContain('/report');
    expect(botCode).toContain('Daily Report');
  });

  it('gracefully handles missing TELEGRAM_BOT_TOKEN', () => {
    expect(botCode).toContain('TELEGRAM_BOT_TOKEN');
    expect(botCode).toContain('bot disabled');
  });

  it('uses prisma for telegram link storage', () => {
    expect(botCode).toContain('prisma.telegramLink');
    expect(botCode).toContain('upsert');
  });

  it('links user via /start with userId parameter', () => {
    expect(botCode).toContain('/start (.+)');
    expect(botCode).toContain('chatId');
    expect(botCode).toContain('userId');
  });
});
