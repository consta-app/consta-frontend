import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createHandoffSession,
  listenForHandoffResult,
  sendHandoffResult,
} from './handoff-session';
import type { HandoffToken, HandoffStatus } from './types';

// ─── WebSocket Mock ──────────────────────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  simulateClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

// Attach WebSocket constants
(MockWebSocket as unknown as Record<string, number>).CONNECTING = 0;
(MockWebSocket as unknown as Record<string, number>).OPEN = 1;
(MockWebSocket as unknown as Record<string, number>).CLOSING = 2;
(MockWebSocket as unknown as Record<string, number>).CLOSED = 3;

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── createHandoffSession ────────────────────────────────────────────────────

describe('createHandoffSession', () => {
  it('returns a valid token and URL', () => {
    const { token, url } = createHandoffSession();

    expect(token.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.used).toBe(false);
    expect(token.expiresAt).toBe(token.createdAt + 300_000);
    expect(url).toContain('/verify-identity/handoff');
    expect(url).toContain(`token=${encodeURIComponent(token.token)}`);
  });

  it('generates unique sessions on successive calls', () => {
    const s1 = createHandoffSession();
    const s2 = createHandoffSession();
    expect(s1.token.token).not.toBe(s2.token.token);
    expect(s1.url).not.toBe(s2.url);
  });

  it('URL uses the current origin in browser context', () => {
    const { url } = createHandoffSession();
    // In jsdom, window.location.origin is typically 'http://localhost'
    expect(url).toMatch(/^https?:\/\//);
  });
});

// ─── listenForHandoffResult ──────────────────────────────────────────────────

describe('listenForHandoffResult', () => {
  function makeToken(overrides?: Partial<HandoffToken>): HandoffToken {
    const now = Date.now();
    return {
      token: 'test-token-abc123',
      createdAt: now,
      expiresAt: now + 300_000,
      used: false,
      ...overrides,
    };
  }

  it('fires waiting status immediately', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toEqual({ kind: 'waiting' });
  });

  it('connects to the relay with correct URL and role', () => {
    const token = makeToken();
    listenForHandoffResult(token, () => {});

    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('/handoff/test-token-abc123');
    expect(ws.url).toContain('role=desktop');
  });

  it('fires connected status when mobile joins', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'connected', role: 'mobile' });

    expect(statuses).toContainEqual({ kind: 'connected' });
  });

  it('fires completed status with result when mobile sends result', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'result', confidence: 0.95, proof: 'abc123' });

    const completed = statuses.find((s) => s.kind === 'completed');
    expect(completed).toEqual({
      kind: 'completed',
      result: { confidence: 0.95, proof: 'abc123' },
    });
  });

  it('marks token as used after receiving result', () => {
    const token = makeToken();
    listenForHandoffResult(token, () => {});

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'result', confidence: 0.9, proof: 'proof' });

    expect(token.used).toBe(true);
  });

  it('fires expired status when relay sends expired message', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'expired' });

    expect(statuses).toContainEqual({ kind: 'expired' });
  });

  it('fires error status when relay sends error message', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'error', message: 'Token already used' });

    expect(statuses).toContainEqual({ kind: 'error', message: 'Token already used' });
  });

  it('fires expired status immediately if token is already expired', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken({ expiresAt: Date.now() - 1000 });

    listenForHandoffResult(token, (s) => statuses.push(s));

    expect(statuses).toContainEqual({ kind: 'expired' });
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('fires expired status when client-side TTL timer fires', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    // Advance time past the token TTL
    vi.advanceTimersByTime(300_000);

    expect(statuses).toContainEqual({ kind: 'expired' });
  });

  it('attempts reconnection on unexpected close (up to 3 retries)', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    // First connection closes unexpectedly
    const ws1 = MockWebSocket.instances[0];
    ws1.simulateOpen();
    ws1.simulateClose();

    // Advance past first backoff (2s)
    vi.advanceTimersByTime(2000);
    expect(MockWebSocket.instances).toHaveLength(2);

    // Second connection closes
    const ws2 = MockWebSocket.instances[1];
    ws2.simulateClose();

    // Advance past second backoff (4s)
    vi.advanceTimersByTime(4000);
    expect(MockWebSocket.instances).toHaveLength(3);

    // Third connection closes
    const ws3 = MockWebSocket.instances[2];
    ws3.simulateClose();

    // Advance past third backoff (8s)
    vi.advanceTimersByTime(8000);
    expect(MockWebSocket.instances).toHaveLength(4);

    // Fourth connection closes — max retries exceeded
    const ws4 = MockWebSocket.instances[3];
    ws4.simulateClose();

    expect(statuses).toContainEqual({
      kind: 'error',
      message: 'Connection lost after multiple retries',
    });
  });

  it('resets retry count on successful connection', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    // First connection opens then closes
    const ws1 = MockWebSocket.instances[0];
    ws1.simulateOpen();
    ws1.simulateClose();

    // Advance past backoff
    vi.advanceTimersByTime(2000);

    // Second connection opens successfully (resets retry count)
    const ws2 = MockWebSocket.instances[1];
    ws2.simulateOpen();
    ws2.simulateMessage({ type: 'result', confidence: 0.88, proof: 'p' });

    expect(statuses).toContainEqual({
      kind: 'completed',
      result: { confidence: 0.88, proof: 'p' },
    });
  });

  it('disconnect() stops listening and closes WebSocket', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    const { disconnect } = listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    disconnect();

    // Should not fire any more statuses
    ws.simulateMessage({ type: 'result', confidence: 0.9, proof: 'x' });
    expect(statuses).not.toContainEqual(expect.objectContaining({ kind: 'completed' }));
  });

  it('ignores malformed messages', () => {
    const statuses: HandoffStatus[] = [];
    const token = makeToken();

    listenForHandoffResult(token, (s) => statuses.push(s));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    // Send invalid JSON via raw onmessage
    ws.onmessage?.(new MessageEvent('message', { data: 'not json' }));

    // Only the initial 'waiting' status should be present
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toEqual({ kind: 'waiting' });
  });
});

// ─── sendHandoffResult ───────────────────────────────────────────────────────

describe('sendHandoffResult', () => {
  it('sends result message with correct format', async () => {
    const promise = sendHandoffResult('my-token', {
      confidence: 0.92,
      proof: 'proof-hash',
    });

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    expect(ws.sent).toHaveLength(1);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent).toEqual({
      type: 'result',
      confidence: 0.92,
      proof: 'proof-hash',
    });

    // Relay closes connection after forwarding
    ws.simulateClose();

    await expect(promise).resolves.toBeUndefined();
  });

  it('connects to relay with mobile role', () => {
    sendHandoffResult('my-token', { confidence: 0.9, proof: 'p' });

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('/handoff/my-token');
    expect(ws.url).toContain('role=mobile');
  });

  it('rejects when relay sends error', async () => {
    const promise = sendHandoffResult('my-token', {
      confidence: 0.9,
      proof: 'p',
    });

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'error', message: 'Token already used' });

    await expect(promise).rejects.toThrow('Token already used');
  });

  it('rejects when relay sends expired', async () => {
    const promise = sendHandoffResult('my-token', {
      confidence: 0.9,
      proof: 'p',
    });

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'expired' });

    await expect(promise).rejects.toThrow('Token expired');
  });

  it('rejects on WebSocket error', async () => {
    const promise = sendHandoffResult('my-token', {
      confidence: 0.9,
      proof: 'p',
    });

    const ws = MockWebSocket.instances[0];
    ws.simulateError();

    await expect(promise).rejects.toThrow('WebSocket connection error');
  });

  it('rejects on timeout', async () => {
    const promise = sendHandoffResult('my-token', {
      confidence: 0.9,
      proof: 'p',
    });

    // Advance past the 30s timeout
    vi.advanceTimersByTime(30_000);

    await expect(promise).rejects.toThrow('Send timed out');
  });
});
