// lib/verification/token-manager.ts
// Token generation and validation for the mobile handoff session.

import type { HandoffToken } from './types';

const TOKEN_TTL_MS = 300_000; // 5 minutes

/**
 * Generates a new handoff token using 32 bytes of cryptographic randomness,
 * encoded as base64url. The token expires after 5 minutes and starts unused.
 */
export function generateToken(): HandoffToken {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // base64url encoding: standard base64 with + → -, / → _, no padding
  const base64 = btoa(String.fromCharCode(...bytes));
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const createdAt = Date.now();

  return {
    token: base64url,
    createdAt,
    expiresAt: createdAt + TOKEN_TTL_MS,
    used: false,
  };
}

/**
 * Returns true if the token has not been used and has not expired.
 */
export function isTokenValid(token: HandoffToken): boolean {
  return !token.used && Date.now() < token.expiresAt;
}
