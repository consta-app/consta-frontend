// relay.js — Minimal handoff relay for local development
// Run: node relay.js
// Connects desktop ↔ mobile for passport capture handoff.
// Only forwards {confidence, proof} — no biometric data.

const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8081;
const TOKEN_TTL_MS = 300_000; // 5 minutes

// In-memory sessions: token → { desktop, mobile, timer, used }
const sessions = new Map();

const wss = new WebSocketServer({ port: PORT });

console.log(`🔗 Handoff relay running on ws://localhost:${PORT}`);
console.log(`   Set NEXT_PUBLIC_HANDOFF_RELAY_URL=ws://localhost:${PORT} in .env.local`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const match = url.pathname.match(/^\/handoff\/([A-Za-z0-9_-]+)$/);
  if (!match) {
    ws.close(4000, "Invalid path");
    return;
  }

  const token = match[1];
  const role = url.searchParams.get("role");
  if (role !== "desktop" && role !== "mobile") {
    ws.close(4001, "Invalid role");
    return;
  }

  console.log(`  → ${role} connected for token ${token.slice(0, 8)}…`);

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
        console.log(`  ✗ Token ${token.slice(0, 8)}… expired`);
      }
    }, TOKEN_TTL_MS);
    sessions.set(token, { desktop: null, mobile: null, timer, used: false });
  }

  const session = sessions.get(token);

  if (session.used) {
    ws.send(JSON.stringify({ type: "error", message: "Token already used" }));
    ws.close(4002, "Token already used");
    return;
  }

  // Register connection by role
  if (role === "desktop") {
    session.desktop = ws;
  } else {
    session.mobile = ws;
    // Notify desktop that mobile connected
    if (session.desktop?.readyState === 1) {
      session.desktop.send(JSON.stringify({ type: "connected", role: "mobile" }));
      console.log(`  ✓ Mobile connected, desktop notified`);
    }
  }

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "result" && role === "mobile") {
        if (session.desktop?.readyState === 1) {
          // Forward only {type, confidence, proof} — nothing else
          session.desktop.send(JSON.stringify({
            type: "result",
            confidence: msg.confidence,
            proof: msg.proof,
          }));
          console.log(`  ✓ Result forwarded to desktop (confidence: ${msg.confidence})`);
        }

        // Mark as used and clean up
        session.used = true;
        clearTimeout(session.timer);
        setTimeout(() => {
          session.desktop?.close();
          session.mobile?.close();
          sessions.delete(token);
        }, 500);
      }
    } catch {
      // Ignore malformed messages
    }
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
