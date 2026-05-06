import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  // 32 байта в hex (64 символа) — фиксированный тестовый ключ
  process.env.IMAP_ENCRYPTION_KEY = 'a'.repeat(64);
});

const { encrypt, decrypt } = require('../../utils/crypto');

describe('utils/crypto — AES-256-GCM', () => {
  it('round-trip: decrypt(encrypt(x)) === x', () => {
    const plain = 'super-secret-password!@#$%^&*()_+';
    const enc = encrypt(plain);
    expect(typeof enc).toBe('string');
    expect(enc).not.toContain(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('encrypt() даёт разные шифры для одного plaintext (рандом IV)', () => {
    const plain = 'pass';
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plain);
    expect(decrypt(b)).toBe(plain);
  });

  it('UTF-8: кириллица round-trip', () => {
    const plain = 'Пароль_русский_тест_🔒';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('encrypt() требует строку', () => {
    expect(() => encrypt(123)).toThrow(TypeError);
    expect(() => encrypt(null)).toThrow(TypeError);
    expect(() => encrypt(undefined)).toThrow(TypeError);
  });

  it('decrypt() требует непустую строку', () => {
    expect(() => decrypt('')).toThrow(TypeError);
    expect(() => decrypt(null)).toThrow(TypeError);
  });

  it('decrypt() кидает при коротком payload', () => {
    expect(() => decrypt('aGVsbG8=')).toThrow(/too short/);
  });

  it('decrypt() кидает при модифицированном tag (auth fail)', () => {
    const enc = encrypt('hello');
    const buf = Buffer.from(enc, 'base64');
    // Меняем 1 байт в tag (offset 12..27)
    buf[15] = buf[15] ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('пустая строка тоже шифруется и расшифровывается', () => {
    const enc = encrypt('');
    expect(decrypt(enc)).toBe('');
  });
});
