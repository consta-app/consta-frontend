// lib/didit.ts
// Client for Didit KYC verification sessions.
// Always calls the real didit-backend.js server (separate from app mocks).

import { ApiError, getCurrentUserId, getSessionToken } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiditSession {
  session_id: string;
  verification_url: string;
  status: DiditStatus;
}

export type DiditStatus =
  | "Not Started"
  | "In Progress"
  | "Approved"
  | "Declined"
  | "Abandoned"
  | "Expired";

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Creates a Didit verification session via the backend proxy.
 */
export async function createDiditSession(): Promise<DiditSession> {
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");

  const token = getSessionToken();
  const res = await fetch(`${API_URL}/verifications/didit/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || "Error creating Didit session");
  }
  const data = await res.json();
  return {
    session_id: data.session_id,
    verification_url: data.verification_url || data.url,
    status: data.status || "Not Started",
  } as DiditSession;
}

/**
 * Polls the status of a Didit session via the backend proxy.
 */
export async function getDiditSessionStatus(
  sessionId: string
): Promise<DiditStatus> {
  const token = getSessionToken();
  const res = await fetch(
    `${API_URL}/verifications/didit/session/${encodeURIComponent(sessionId)}/status`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) {
    throw new ApiError(res.status, "Error fetching session status");
  }
  const data = await res.json();
  return data.status as DiditStatus;
}
