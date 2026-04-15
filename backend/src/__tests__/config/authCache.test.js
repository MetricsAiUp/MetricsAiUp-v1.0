import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need a fresh module for each test to reset the internal Map
let authCache;

describe('authCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Re-import fresh module each time to reset internal state
    vi.resetModules();
    authCache = require('../../config/authCache');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('stores and retrieves data', () => {
      const userData = { id: 'u1', email: 'test@test.com', role: 'admin' };
      authCache.set('u1', userData);

      const result = authCache.get('u1');
      expect(result).toEqual(userData);
    });

    it('stores multiple entries independently', () => {
      authCache.set('u1', { id: 'u1' });
      authCache.set('u2', { id: 'u2' });

      expect(authCache.get('u1')).toEqual({ id: 'u1' });
      expect(authCache.get('u2')).toEqual({ id: 'u2' });
    });

    it('overwrites existing entry for same userId', () => {
      authCache.set('u1', { id: 'u1', name: 'Old' });
      authCache.set('u1', { id: 'u1', name: 'New' });

      expect(authCache.get('u1')).toEqual({ id: 'u1', name: 'New' });
    });
  });

  describe('TTL expiry', () => {
    it('returns data before TTL expires', () => {
      authCache.set('u1', { id: 'u1' });

      // Advance 14 minutes (within 15 min TTL)
      vi.advanceTimersByTime(14 * 60 * 1000);

      expect(authCache.get('u1')).toEqual({ id: 'u1' });
    });

    it('returns null for expired entries (TTL 15 min)', () => {
      authCache.set('u1', { id: 'u1' });

      // Advance 16 minutes (past 15 min TTL)
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(authCache.get('u1')).toBeNull();
    });

    it('returns null at exactly TTL + 1ms', () => {
      authCache.set('u1', { id: 'u1' });

      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      expect(authCache.get('u1')).toBeNull();
    });

    it('deletes expired entry from cache on access', () => {
      authCache.set('u1', { id: 'u1' });

      vi.advanceTimersByTime(16 * 60 * 1000);
      authCache.get('u1'); // triggers deletion

      // Re-set and verify the old expired entry is gone
      authCache.set('u1', { id: 'u1', fresh: true });
      expect(authCache.get('u1')).toEqual({ id: 'u1', fresh: true });
    });
  });

  describe('invalidate', () => {
    it('removes specific entry', () => {
      authCache.set('u1', { id: 'u1' });
      authCache.set('u2', { id: 'u2' });

      authCache.invalidate('u1');

      expect(authCache.get('u1')).toBeNull();
      expect(authCache.get('u2')).toEqual({ id: 'u2' });
    });

    it('does not throw when invalidating non-existent entry', () => {
      expect(() => authCache.invalidate('nonexistent')).not.toThrow();
    });
  });

  describe('invalidateAll', () => {
    it('clears everything', () => {
      authCache.set('u1', { id: 'u1' });
      authCache.set('u2', { id: 'u2' });
      authCache.set('u3', { id: 'u3' });

      authCache.invalidateAll();

      expect(authCache.get('u1')).toBeNull();
      expect(authCache.get('u2')).toBeNull();
      expect(authCache.get('u3')).toBeNull();
    });

    it('does not throw when cache is already empty', () => {
      expect(() => authCache.invalidateAll()).not.toThrow();
    });
  });

  describe('get edge cases', () => {
    it('returns null for non-existent entries', () => {
      expect(authCache.get('nonexistent')).toBeNull();
    });

    it('returns null for undefined userId', () => {
      expect(authCache.get(undefined)).toBeNull();
    });
  });
});
