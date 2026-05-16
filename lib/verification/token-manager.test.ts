import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateToken, isTokenValid } from './token-manager';

describe('TokenManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('returns a token with base64url-encoded string of 32 random bytes', () => {
      const token = generateToken();
      // 32 bytes → 44 base64 chars → up to 43 base64url chars (no padding)
      expect(token.token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.token.length).toBeGreaterThanOrEqual(42);
      expect(token.token.length).toBeLessThanOrEqual(43);
    });

    it('sets createdAt to approximately Date.now()', () => {
      const before = Date.now();
      const token = generateToken();
      const after = Date.now();
      expect(token.createdAt).toBeGreaterThanOrEqual(before);
      expect(token.createdAt).toBeLessThanOrEqual(after);
    });

    it('sets expiresAt to createdAt + 300,000ms (5 minutes)', () => {
      const token = generateToken();
      expect(token.expiresAt).toBe(token.createdAt + 300_000);
    });

    it('sets used to false', () => {
      const token = generateToken();
      expect(token.used).toBe(false);
    });

    it('generates unique tokens on successive calls', () => {
      const t1 = generateToken();
      const t2 = generateToken();
      expect(t1.token).not.toBe(t2.token);
    });
  });

  describe('isTokenValid', () => {
    it('returns true for a fresh, unused token', () => {
      const token = generateToken();
      expect(isTokenValid(token)).toBe(true);
    });

    it('returns false when token.used is true', () => {
      const token = generateToken();
      token.used = true;
      expect(isTokenValid(token)).toBe(false);
    });

    it('returns false when token has expired', () => {
      const token = generateToken();
      // Simulate time passing beyond expiration
      vi.spyOn(Date, 'now').mockReturnValue(token.expiresAt + 1);
      expect(isTokenValid(token)).toBe(false);
    });

    it('returns true just before expiration', () => {
      const token = generateToken();
      vi.spyOn(Date, 'now').mockReturnValue(token.expiresAt - 1);
      expect(isTokenValid(token)).toBe(true);
    });

    it('returns false at exact expiration time', () => {
      const token = generateToken();
      vi.spyOn(Date, 'now').mockReturnValue(token.expiresAt);
      expect(isTokenValid(token)).toBe(false);
    });

    it('returns false when both used and expired', () => {
      const token = generateToken();
      token.used = true;
      vi.spyOn(Date, 'now').mockReturnValue(token.expiresAt + 1);
      expect(isTokenValid(token)).toBe(false);
    });
  });
});
