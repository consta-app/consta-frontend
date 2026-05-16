// lib/verification/handoff-session.ts
// Desktop-to-mobile handoff session management via WebSocket relay.

import type { HandoffToken, HandoffResult, HandoffStatus } from './types';
import { generateToken, isTokenValid } from './token-manager';

const TOKEN_TTL_MS = 300_000; // 5 minutes

const RELAY_URL =
  (typeof process !== 'undefined' &&
    process.env?.NEXT_PUBLIC_HANDOFF_RELAY_URL) ||
  'wss://relay.example.com';

const HANDOFF_PATH = '/verify-identity/handoff';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

/**
 * Creates a new handoff session. Returns the token and a URL to encode in the QR code.
 * The URL points to the app's own /verify-identity/handoff route with the token as a query param.
 */
export function createHandoffSession(): { token: HandoffToken; url: string } {
  const token = generateToken();

  // Build the handoff URL for the mobile device.
  // In a browser context, use window.location.origin; otherwise fall back to a placeholder.
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://app.example.com';

  const url = `${origin}${HANDOFF_PATH}?token=${encodeURIComponent(token.token)}`;

  return { token, url };
}

/**
 * Desktop side: connects to the WebSocket relay and listens for mobile result.
 * Handles status transitions: waiting → connected → completed/expired/error.
 * Implements reconnection with exponential backoff (3 retries, 2s base).
 * Also sets a client-side expiration timer based on the token's remaining TTL.
 */
export function listenForHandoffResult(
  token: HandoffToken,
  onStatusChange: (status: HandoffStatus) => void
): { disconnect: () => void } {
  let ws: WebSocket | null = null;
  let retryCount = 0;
  let disconnected = false;
  let expirationTimer: ReturnType<typeof setTimeout> | null = null;

  // Fire initial waiting status
  onStatusChange({ kind: 'waiting' });

  // Set up client-side expiration timer
  const remainingTTL = token.expiresAt - Date.now();
  if (remainingTTL <= 0) {
    onStatusChange({ kind: 'expired' });
    return { disconnect: () => {} };
  }

  expirationTimer = setTimeout(() => {
    if (!disconnected) {
      onStatusChange({ kind: 'expired' });
      cleanup();
    }
  }, remainingTTL);

  function cleanup() {
    disconnected = true;
    if (expirationTimer !== null) {
      clearTimeout(expirationTimer);
      expirationTimer = null;
    }
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }
  }

  function connect() {
    if (disconnected) return;

    // Validate token before connecting
    if (!isTokenValid(token)) {
      onStatusChange({ kind: 'expired' });
      cleanup();
      return;
    }

    const wsUrl = `${RELAY_URL}/handoff/${encodeURIComponent(token.token)}?role=desktop`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Reset retry count on successful connection
      retryCount = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      if (disconnected) return;

      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '');

        switch (data.type) {
          case 'connected':
            if (data.role === 'mobile') {
              onStatusChange({ kind: 'connected' });
            }
            break;

          case 'result':
            if (
              typeof data.confidence === 'number' &&
              typeof data.proof === 'string'
            ) {
              token.used = true;
              onStatusChange({
                kind: 'completed',
                result: {
                  confidence: data.confidence,
                  proof: data.proof,
                },
              });
              cleanup();
            }
            break;

          case 'expired':
            onStatusChange({ kind: 'expired' });
            cleanup();
            break;

          case 'error':
            onStatusChange({
              kind: 'error',
              message: data.message || 'Unknown relay error',
            });
            break;

          default:
            // Ignore unknown message types
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // Error handling is done in onclose
    };

    ws.onclose = () => {
      if (disconnected) return;

      // Attempt reconnection with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, retryCount);
        retryCount++;
        setTimeout(() => connect(), backoff);
      } else {
        onStatusChange({
          kind: 'error',
          message: 'Connection lost after multiple retries',
        });
        cleanup();
      }
    };
  }

  connect();

  return {
    disconnect: () => {
      cleanup();
    },
  };
}

/**
 * Mobile side: sends {confidence, proof} to the relay for the given token.
 * Opens a WebSocket, sends the result message, and waits for acknowledgment or close.
 */
export function sendHandoffResult(
  token: string,
  result: HandoffResult
): Promise<void> {
  return new Promise((resolve, reject) => {
    const wsUrl = `${RELAY_URL}/handoff/${encodeURIComponent(token)}?role=mobile`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      reject(new Error('Failed to create WebSocket connection'));
      return;
    }

    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error('Send timed out'));
      }
    }, 30_000); // 30s timeout for sending

    ws.onopen = () => {
      const message = JSON.stringify({
        type: 'result',
        confidence: result.confidence,
        proof: result.proof,
      });
      ws.send(message);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (settled) return;

      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '');

        if (data.type === 'error') {
          settled = true;
          clearTimeout(timeout);
          ws.close();
          reject(new Error(data.message || 'Relay error'));
          return;
        }

        if (data.type === 'expired') {
          settled = true;
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Token expired'));
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        // Normal close after sending means success (relay closes after forwarding)
        resolve();
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('WebSocket connection error'));
      }
    };
  });
}
