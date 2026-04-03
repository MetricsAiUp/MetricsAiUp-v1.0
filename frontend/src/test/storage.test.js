import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../services/storage';

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('set and get JSON object', () => {
    storage.set('test-key', { a: 1, b: 'hello' });
    expect(storage.get('test-key')).toEqual({ a: 1, b: 'hello' });
  });

  it('set and get string', () => {
    storage.set('lang', 'ru');
    expect(storage.getString('lang')).toBe('ru');
  });

  it('returns fallback for missing key', () => {
    expect(storage.get('nonexistent', 'fallback')).toBe('fallback');
  });

  it('returns empty string fallback for getString', () => {
    expect(storage.getString('nonexistent')).toBe('');
  });

  it('remove deletes key', () => {
    storage.set('temp', { x: 1 });
    storage.remove('temp');
    expect(storage.get('temp')).toBeNull();
  });

  it('set null removes key', () => {
    storage.set('temp', 'value');
    storage.set('temp', null);
    expect(localStorage.getItem('temp')).toBeNull();
  });

  it('KEYS has expected keys', () => {
    expect(storage.KEYS.TOKEN).toBe('token');
    expect(storage.KEYS.CURRENT_USER).toBe('currentUser');
    expect(storage.KEYS.THEME).toBe('theme');
    expect(storage.KEYS.LANGUAGE).toBe('language');
  });

  it('clearAll removes all app keys', () => {
    storage.set(storage.KEYS.TOKEN, 'abc');
    storage.set(storage.KEYS.THEME, 'dark');
    storage.clearAll();
    expect(storage.get(storage.KEYS.TOKEN)).toBeNull();
    expect(storage.get(storage.KEYS.THEME)).toBeNull();
  });
});
