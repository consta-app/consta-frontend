// didit-backend.js — Temporary local backend for Didit KYC integration testing.
// Run: node didit-backend.js
//
// This proxies Didit API calls so the frontend doesn't expose the API key.
// In production, these endpoints would live in your real backend.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DIDIT_API_KEY = process.env.DIDIT_API_KEY || "SVhpkCkzMKH6c9GnCcdb5f8onDx-QsjUscdsMX-4qmY";
const DIDIT_API_URL = "https://verification.didit.me";

// You need to set this to your actual workflow ID from the Didit console.
// Go to business.didit.me → Workflows → copy the workflow ID.
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || "06d48ae9-221a-4952-829a-2f7850807937";

// ─── Create a Didit verification session ─────────────────────────────────────

app.post("/verifications/didit/session", async (req, res) => {
  const { user_id } = req.body;

  if (!DIDIT_WORKFLOW_ID) {
    // If no workflow ID is configured, return the direct verification URL
    // from the Didit console (the /u/ link you shared)
    return res.status(201).json({
      session_id: `direct-${Date.now()}`,
      verification_url: "https://verify.didit.me/u/BtSK6SIaSVKCmi94UIB5Nw",
      status: "Not Started",
    });
  }

  try {
    const response = await fetch(`${DIDIT_API_URL}/v3/session/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DIDIT_API_KEY,
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: user_id || "anonymous",
        callback: "http://localhost:3000/verify-identity",
        language: "es",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Didit API error:", response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    console.log("✓ Session created:", data.session_id);

    res.status(201).json({
      session_id: data.session_id,
      verification_url: data.url,
      status: data.status,
    });
  } catch (err) {
    console.error("Error creating session:", err.message);
    res.status(500).json({ error: "Failed to create Didit session" });
  }
});

// ─── Get session status ──────────────────────────────────────────────────────

app.get("/verifications/didit/session/:sessionId/status", async (req, res) => {
  const { sessionId } = req.params;

  // If using direct URL mode (no workflow ID), we can't poll status
  if (sessionId.startsWith("direct-")) {
    return res.json({ status: "Not Started" });
  }

  try {
    const response = await fetch(
      `${DIDIT_API_URL}/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      {
        headers: {
          "x-api-key": DIDIT_API_KEY,
        },
      }
    );

    if (!response.ok) {
      // Session might not have a decision yet
      if (response.status === 404) {
        return res.json({ status: "In Progress" });
      }
      const text = await response.text();
      console.error("Didit status error:", response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const status = data.status || "In Progress";

    // PRIVACY: Once we have a final decision (Approved/Declined), immediately
    // delete the session from Didit's servers. We only need the yes/no result —
    // no biometric data, document images, or personal info should be retained.
    if (status === "Approved" || status === "Declined") {
      deleteSessionFromDidit(sessionId);
    }

    res.json({ status });
  } catch (err) {
    console.error("Error fetching status:", err.message);
    res.status(500).json({ error: "Failed to fetch session status" });
  }
});

// ─── Auto-delete session from Didit after getting result ─────────────────────
// PRIVACY: We delete all biometric data, document images, and personal info
// from Didit's servers immediately after receiving the verification decision.
// Only the Approved/Declined result is kept locally.

const deletedSessions = new Set(); // Prevent duplicate delete calls

async function deleteSessionFromDidit(sessionId) {
  if (deletedSessions.has(sessionId)) return;
  deletedSessions.add(sessionId);

  try {
    const response = await fetch(
      `${DIDIT_API_URL}/v3/session/${encodeURIComponent(sessionId)}/delete/`,
      {
        method: "DELETE",
        headers: {
          "x-api-key": DIDIT_API_KEY,
        },
      }
    );

    if (response.status === 204 || response.ok) {
      console.log(`  🗑️  Session ${sessionId.slice(0, 8)}… deleted from Didit`);
    } else {
      console.error(`  ✗ Failed to delete session: ${response.status}`);
    }
  } catch (err) {
    console.error(`  ✗ Error deleting session: ${err.message}`);
  }
}

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ ok: true, didit_configured: !!DIDIT_WORKFLOW_ID });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🔑 Didit test backend running on http://localhost:${PORT}`);
  console.log(`   API Key: ${DIDIT_API_KEY.slice(0, 8)}…`);
  console.log(`   Workflow ID: ${DIDIT_WORKFLOW_ID || "(not set — using direct URL)"}`);
  console.log(`   🗑️  Auto-delete: ON (sessions deleted from Didit after result)`);
  console.log(`\n   The frontend at localhost:3000 will call this server.\n`);
});
