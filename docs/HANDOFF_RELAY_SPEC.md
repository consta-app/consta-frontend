# Handoff Relay Server — Backend Specification

## Purpose

The handoff relay enables desktop users to delegate passport capture to their phone. It's a minimal WebSocket relay that forwards a single JSON message between two clients (desktop ↔ mobile). **No biometric data passes through this server.**

## What the relay sees

Only this payload:

```json
{"type": "result", "confidence": 0.342, "proof": "sha256-hash-string"}
```

- `confidence`: a float (face similarity distance). Not personally identifiable.
- `proof`: a SHA-256 hash of the face embedding + timestamp. Cannot be reversed.

**The relay never receives:** passport images, face photos, face embeddings, names, document numbers, MRZ data, or any biometric information.

## Protocol

### Endpoint

```
wss://{relay-host}/handoff/{token}?role={desktop|mobile}
```

- `token`: 32-byte random value, base64url-encoded (provided by the frontend)
- `role`: either `desktop` or `mobile`

### Connection flow

```
1. Desktop opens:  wss://relay/handoff/{token}?role=desktop
2. Desktop waits.
3. Mobile opens:   wss://relay/handoff/{token}?role=mobile
4. Relay → Desktop: {"type": "connected", "role": "mobile"}
5. Mobile → Relay:  {"type": "result", "confidence": 0.34, "proof": "abc123..."}
6. Relay → Desktop: {"type": "result", "confidence": 0.34, "proof": "abc123..."}
7. Relay closes both connections.
8. Token is invalidated (single-use).
```

### Messages (JSON, text frames)

| Direction | Message | When |
|-----------|---------|------|
| Relay → Desktop | `{"type": "connected", "role": "mobile"}` | Mobile connects |
| Mobile → Relay | `{"type": "result", "confidence": number, "proof": string}` | Phone completed verification |
| Relay → Desktop | `{"type": "result", "confidence": number, "proof": string}` | Forwarded from mobile |
| Relay → Both | `{"type": "expired"}` | Token TTL elapsed |
| Relay → Sender | `{"type": "error", "message": string}` | Invalid token, already used, etc. |

### Token rules

- **TTL:** 5 minutes (300 seconds) from first connection
- **Single-use:** After a `result` message is delivered, the token is invalidated
- **Entropy:** 256 bits (32 bytes, base64url). Generated client-side — the relay just validates format
- **No storage required:** Tokens can be kept in memory. They expire quickly.

## Requirements

| Requirement | Detail |
|-------------|--------|
| Protocol | WebSocket (WSS in production) |
| Persistence | None. In-memory token map is sufficient. |
| Scalability | Low traffic. Single instance is fine for <1000 concurrent handoffs. |
| Auth | None required on the relay itself. The token is the auth. |
| CORS | Not applicable (WebSocket doesn't use CORS) |
| TLS | Required in production (WSS) |
| Logging | **Do NOT log message payloads.** Log only connection events (token, role, timestamp). |

## Deployment options

| Platform | Suitable? | Notes |
|----------|-----------|-------|
| Railway | ✅ | Native WebSocket support, cheap |
| Fly.io | ✅ | Good for persistent connections |
| Your existing backend | ✅ | Add a WS endpoint to your current server |
| Any VPS (DigitalOcean, etc.) | ✅ | Full control |
| Vercel | ❌ | Serverless, can't hold connections open |
| AWS Lambda | ❌ | Same issue (use API Gateway + Lambda only if you add DynamoDB for state) |

## Reference implementation (Node.js)

```javascript
// relay.js — Minimal handoff relay (~60 lines)
// Run: node relay.js
// Or deploy to Railway/Fly.io

const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const TOKEN_TTL_MS = 300_000; // 5 minutes

// In-memory token → { desktop: ws, mobile: ws, timer: timeout }
const sessions = new Map();

const wss = new WebSocketServer({ port: PORT });
console.log(`Relay listening on port ${PORT}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const match = url.pathname.match(/^\/handoff\/([A-Za-z0-9_-]+)$/);
  if (!match) return ws.close(4000, "Invalid path");

  const token = match[1];
  const role = url.searchParams.get("role");
  if (role !== "desktop" && role !== "mobile") return ws.close(4001, "Invalid role");

  // Get or create session
  if (!sessions.has(token)) {
    const timer = setTimeout(() => {
      const s = sessions.get(token);
      if (s) {
        const msg = JSON.stringify({ type: "expired" });
        if (s.desktop?.readyState === 1) s.desktop.send(msg);
        if (s.mobile?.readyState === 1) s.mobile.send(msg);
        s.desktop?.close();
        s.mobile?.close();
        sessions.delete(token);
      }
    }, TOKEN_TTL_MS);
    sessions.set(token, { desktop: null, mobile: null, timer, used: false });
  }

  const session = sessions.get(token);

  if (session.used) {
    ws.send(JSON.stringify({ type: "error", message: "Token already used" }));
    return ws.close(4002, "Token already used");
  }

  // Register connection
  if (role === "desktop") {
    session.desktop = ws;
  } else {
    session.mobile = ws;
    // Notify desktop that mobile connected
    if (session.desktop?.readyState === 1) {
      session.desktop.send(JSON.stringify({ type: "connected", role: "mobile" }));
    }
  }

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "result" && role === "mobile" && session.desktop?.readyState === 1) {
        // Forward result to desktop
        session.desktop.send(JSON.stringify({
          type: "result",
          confidence: msg.confidence,
          proof: msg.proof,
        }));
        // Mark as used and clean up
        session.used = true;
        clearTimeout(session.timer);
        session.desktop.close();
        session.mobile.close();
        sessions.delete(token);
      }
    } catch { /* ignore malformed */ }
  });

  ws.on("close", () => {
    if (session.desktop === ws) session.desktop = null;
    if (session.mobile === ws) session.mobile = null;
    // Clean up empty sessions
    if (!session.desktop && !session.mobile && !session.used) {
      clearTimeout(session.timer);
      sessions.delete(token);
    }
  });
});
```

## Frontend integration

Once deployed, the frontend developer sets:

```bash
# .env.local
NEXT_PUBLIC_HANDOFF_RELAY_URL=wss://your-relay-host.example.com
```

No other frontend changes needed — the handoff code already reads this variable.

## Security notes

- The relay is designed to be **untrusted**. Even if compromised, no biometric data is exposed.
- Do NOT add authentication that requires user identity — the token IS the auth.
- Do NOT log message payloads in production.
- Rate-limit connections per IP to prevent abuse (e.g., 10 connections/minute).
- Consider adding a simple health check endpoint (`GET /health → 200`) for monitoring.
