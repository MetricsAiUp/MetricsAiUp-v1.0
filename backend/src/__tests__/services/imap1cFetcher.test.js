import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');
const fetcher = require('../../services/imap1cFetcher');

function ensureModels() {
  if (!prisma.imap1CConfig) prisma.imap1CConfig = {};
}

describe('imap1cFetcher — fetchOnce() guard paths', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('returns no_config when config row missing', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue(null);
    const out = await fetcher.fetchOnce();
    expect(out).toEqual({ ok: false, reason: 'no_config' });
  });

  it('returns disabled when enabled=false (and not manual)', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({
      id: 1, enabled: false, user: 'a@b.c', passwordEncrypted: 'x',
    });
    const out = await fetcher.fetchOnce();
    expect(out).toEqual({ ok: false, reason: 'disabled' });
  });

  it('returns no_user when user is empty', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({
      id: 1, enabled: true, user: '', passwordEncrypted: 'x',
    });
    const out = await fetcher.fetchOnce();
    expect(out).toEqual({ ok: false, reason: 'no_user' });
  });

  it('returns no_password and updates config when password decryption fails', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({
      id: 1, enabled: true, user: 'a@b.c', passwordEncrypted: 'garbled',
    });
    const updateSpy = vi.spyOn(prisma.imap1CConfig, 'update').mockResolvedValue({});
    const out = await fetcher.fetchOnce();
    expect(out).toEqual({ ok: false, reason: 'no_password' });
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ lastFetchStatus: 'error', lastFetchError: 'cannot_decrypt_password' }),
    }));
  });

  it('returns no_password when passwordEncrypted is null', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({
      id: 1, enabled: true, user: 'a@b.c', passwordEncrypted: null,
    });
    vi.spyOn(prisma.imap1CConfig, 'update').mockResolvedValue({});
    const out = await fetcher.fetchOnce();
    expect(out).toEqual({ ok: false, reason: 'no_password' });
  });

  it('manual=true bypasses enabled=false', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({
      id: 1, enabled: false, user: 'a@b.c', passwordEncrypted: null,
    });
    vi.spyOn(prisma.imap1CConfig, 'update').mockResolvedValue({});
    const out = await fetcher.fetchOnce({ manual: true });
    // Bypasses 'disabled' but still fails because no decryptable password
    expect(out.reason).toBe('no_password');
  });
});

describe('imap1cFetcher — start()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('creates default config when none exists', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue(null);
    const createSpy = vi.spyOn(prisma.imap1CConfig, 'create').mockResolvedValue({});
    await fetcher.start();
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 1 } }));
  });

  it('does not schedule cron when config.enabled is false', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({ id: 1, enabled: false });
    const cronSpy = vi.spyOn(require('node-cron'), 'schedule');
    await fetcher.start();
    expect(cronSpy).not.toHaveBeenCalled();
  });
});

describe('imap1cFetcher — module exports', () => {
  it('exports public API', () => {
    expect(typeof fetcher.start).toBe('function');
    expect(typeof fetcher.stop).toBe('function');
    expect(typeof fetcher.reschedule).toBe('function');
    expect(typeof fetcher.fetchOnce).toBe('function');
    expect(typeof fetcher.testConnection).toBe('function');
  });

  it('stop() is a safe no-op when no task scheduled', () => {
    expect(() => fetcher.stop()).not.toThrow();
  });
});

describe('imap1cFetcher — reschedule()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureModels();
  });

  it('does nothing when no config row exists', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue(null);
    await expect(fetcher.reschedule()).resolves.toBeUndefined();
  });

  it('does not schedule when config.enabled=false', async () => {
    vi.spyOn(prisma.imap1CConfig, 'findUnique').mockResolvedValue({ id: 1, enabled: false });
    const cronSpy = vi.spyOn(require('node-cron'), 'schedule');
    await fetcher.reschedule();
    expect(cronSpy).not.toHaveBeenCalled();
  });
});
