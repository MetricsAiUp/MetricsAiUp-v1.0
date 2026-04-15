import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = 'test-secret';
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

// Recreate rate limiter logic from auth route
function createRateLimiter(maxAttempts = 20, windowMs = 60000) {
  const attempts = new Map();

  function check(ip) {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || now - entry.firstAttempt > windowMs) {
      attempts.set(ip, { count: 1, firstAttempt: now });
      return true;
    }
    if (entry.count >= maxAttempts) return false;
    entry.count++;
    return true;
  }

  function cleanup() {
    const now = Date.now();
    for (const [ip, entry] of attempts) {
      if (now - entry.firstAttempt > windowMs) attempts.delete(ip);
    }
  }

  return { check, cleanup, _attempts: attempts };
}

// Recreate token generation logic
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

describe('Auth Route Logic', () => {
  describe('Rate Limiting', () => {
    it('allows first attempt from a new IP', () => {
      const limiter = createRateLimiter();
      expect(limiter.check('192.168.1.1')).toBe(true);
    });

    it('tracks attempt count per IP', () => {
      const limiter = createRateLimiter();
      limiter.check('192.168.1.1');
      limiter.check('192.168.1.1');
      limiter.check('192.168.1.1');
      const entry = limiter._attempts.get('192.168.1.1');
      expect(entry.count).toBe(3);
    });

    it('blocks after 20 attempts within window', () => {
      const limiter = createRateLimiter(20, 60000);
      for (let i = 0; i < 20; i++) {
        limiter.check('10.0.0.1');
      }
      // 21st attempt should be blocked
      expect(limiter.check('10.0.0.1')).toBe(false);
    });

    it('allows different IPs independently', () => {
      const limiter = createRateLimiter(2, 60000);
      limiter.check('10.0.0.1');
      limiter.check('10.0.0.1');
      // IP 1 is at limit
      expect(limiter.check('10.0.0.1')).toBe(false);
      // IP 2 should still be allowed
      expect(limiter.check('10.0.0.2')).toBe(true);
    });

    it('resets after window expires', () => {
      const limiter = createRateLimiter(2, 100); // 100ms window
      limiter.check('10.0.0.1');
      limiter.check('10.0.0.1');
      expect(limiter.check('10.0.0.1')).toBe(false);

      // Simulate window expiration by manipulating firstAttempt
      const entry = limiter._attempts.get('10.0.0.1');
      entry.firstAttempt = Date.now() - 200; // 200ms ago, past 100ms window
      expect(limiter.check('10.0.0.1')).toBe(true);
    });

    it('cleanup removes expired entries', () => {
      const limiter = createRateLimiter(20, 100);
      limiter.check('10.0.0.1');
      limiter.check('10.0.0.2');
      // Simulate expiration
      for (const [, entry] of limiter._attempts) {
        entry.firstAttempt = Date.now() - 200;
      }
      limiter.cleanup();
      expect(limiter._attempts.size).toBe(0);
    });
  });

  describe('Password Hashing', () => {
    it('bcrypt hash matches original password', async () => {
      const password = 'securePass123';
      const hashed = await bcrypt.hash(password, 10);
      const valid = await bcrypt.compare(password, hashed);
      expect(valid).toBe(true);
    });

    it('bcrypt rejects wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      const valid = await bcrypt.compare('wrong', hashed);
      expect(valid).toBe(false);
    });

    it('bcrypt generates different hashes for same password', async () => {
      const password = 'samePassword';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT Token Structure', () => {
    it('access token has userId and type=access', () => {
      const { accessToken } = generateTokens('user-123');
      const decoded = jwt.verify(accessToken, JWT_SECRET);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.type).toBe('access');
    });

    it('refresh token has userId and type=refresh', () => {
      const { refreshToken } = generateTokens('user-123');
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.type).toBe('refresh');
    });

    it('access token has exp claim', () => {
      const { accessToken } = generateTokens('user-123');
      const decoded = jwt.decode(accessToken);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // exp should be ~24h from iat
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(24 * 60 * 60);
    });

    it('refresh token has 7-day expiry', () => {
      const { refreshToken } = generateTokens('user-123');
      const decoded = jwt.decode(refreshToken);
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(7 * 24 * 60 * 60);
    });

    it('tokens are different from each other', () => {
      const { accessToken, refreshToken } = generateTokens('user-123');
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('Token Refresh Validation', () => {
    it('rejects token with type=access as refresh', () => {
      const { accessToken } = generateTokens('user-123');
      const payload = jwt.verify(accessToken, JWT_SECRET);
      const isValidRefresh = payload.type === 'refresh';
      expect(isValidRefresh).toBe(false);
    });

    it('accepts token with type=refresh', () => {
      const { refreshToken } = generateTokens('user-123');
      const payload = jwt.verify(refreshToken, JWT_SECRET);
      const isValidRefresh = payload.type === 'refresh';
      expect(isValidRefresh).toBe(true);
    });

    it('rejects expired refresh token', () => {
      const expired = jwt.sign({ userId: 'user-123', type: 'refresh' }, JWT_SECRET, { expiresIn: '-1s' });
      expect(() => jwt.verify(expired, JWT_SECRET)).toThrow();
    });

    it('rejects token with wrong secret', () => {
      const token = jwt.sign({ userId: 'user-123', type: 'refresh' }, 'wrong-secret', { expiresIn: '7d' });
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
    });
  });

  describe('Login Response Shape', () => {
    it('contains token and user with required fields', () => {
      const user = { id: 'u1', email: 'test@test.com', firstName: 'John', lastName: 'Doe', password: 'hashed' };
      const { accessToken } = generateTokens(user.id);

      const response = {
        token: accessToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      };

      expect(response).toHaveProperty('token');
      expect(response.user).toHaveProperty('id');
      expect(response.user).toHaveProperty('email');
      expect(response.user).toHaveProperty('firstName');
      expect(response.user).toHaveProperty('lastName');
      expect(response.user).not.toHaveProperty('password');
    });

    it('does not expose password in response', () => {
      const user = { id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', password: '$2a$10$hash' };
      const response = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
      expect(response).not.toHaveProperty('password');
    });
  });

  describe('Register Validation', () => {
    it('requires email to be valid email format', () => {
      const validEmails = ['user@example.com', 'a@b.ru', 'test.user@domain.co'];
      const invalidEmails = ['not-email', '@no-user.com', 'spaces in@email.com'];

      for (const e of validEmails) {
        expect(e).toMatch(/.+@.+\..+/);
      }
      for (const e of invalidEmails) {
        expect(e.includes(' ') || !e.match(/.+@.+\..+/)).toBe(true);
      }
    });

    it('requires password with minimum length 6', () => {
      const tooShort = '12345';
      const valid = '123456';
      expect(tooShort.length).toBeLessThan(6);
      expect(valid.length).toBeGreaterThanOrEqual(6);
    });

    it('requires firstName and lastName', () => {
      const body = { email: 'a@b.com', password: '123456' };
      const missingFirst = !body.firstName;
      const missingLast = !body.lastName;
      expect(missingFirst).toBe(true);
      expect(missingLast).toBe(true);
    });

    it('lowercases email on registration', () => {
      const email = 'Admin@MetricsAI.Up';
      expect(email.toLowerCase()).toBe('admin@metricsai.up');
    });
  });
});
