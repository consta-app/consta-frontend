"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { HandoffResult, HandoffStatus } from "@/lib/verification/types";
import {
  createHandoffSession,
  listenForHandoffResult,
} from "@/lib/verification/handoff-session";

export interface HandoffUIProps {
  onResultReceived: (result: HandoffResult) => void;
  onExpired: () => void;
  onCancel: () => void;
}

const HANDOFF_TTL_MS = 300_000; // 5 minutes

/**
 * Desktop-side handoff interface:
 * - Generates and displays QR code encoding the handoff URL with token
 * - Shows countdown timer (5 minutes) with visual progress bar
 * - Displays connection status (waiting → connected → completed)
 * - Handles expiration with option to regenerate QR code
 * - Keyboard-navigable with visible focus indicators
 *
 * Validates: Requirements 3.1, 3.6, 5.6
 */
export function HandoffUI({ onResultReceived, onExpired, onCancel }: HandoffUIProps) {
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<HandoffStatus>({ kind: "waiting" });
  const [remainingMs, setRemainingMs] = useState(HANDOFF_TTL_MS);
  const [expired, setExpired] = useState(false);

  const disconnectRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(() => {
    // Clean up any previous session
    if (disconnectRef.current) {
      disconnectRef.current();
      disconnectRef.current = null;
    }
    clearTimers();

    // Create new session
    const { token, url } = createHandoffSession();
    setHandoffUrl(url);
    setStatus({ kind: "waiting" });
    setExpired(false);
    setRemainingMs(HANDOFF_TTL_MS);
    startTimeRef.current = Date.now();

    // Start countdown timer
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, HANDOFF_TTL_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearTimers();
        setExpired(true);
      }
    }, 1000);

    // Listen for handoff result via WebSocket
    const { disconnect } = listenForHandoffResult(token, (newStatus) => {
      setStatus(newStatus);

      if (newStatus.kind === "expired") {
        setExpired(true);
        clearTimers();
      }

      if (newStatus.kind === "completed") {
        clearTimers();
        onResultReceived(newStatus.result);
      }
    });

    disconnectRef.current = disconnect;
  }, [clearTimers, onResultReceived]);

  // Initialize session on mount
  useEffect(() => {
    startSession();

    return () => {
      if (disconnectRef.current) {
        disconnectRef.current();
        disconnectRef.current = null;
      }
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerate = useCallback(() => {
    startSession();
  }, [startSession]);

  // Notify parent when session expires
  useEffect(() => {
    if (expired) {
      onExpired();
    }
  }, [expired, onExpired]);

  // Format remaining time as mm:ss
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Progress percentage (1 = full, 0 = expired)
  const progress = remainingMs / HANDOFF_TTL_MS;

  // Status display text
  const statusText = (() => {
    if (expired) return "Código expirado";
    switch (status.kind) {
      case "waiting":
        return "Esperando conexión…";
      case "connected":
        return "Teléfono conectado";
      case "completed":
        return "Verificación completada";
      case "error":
        return `Error: ${status.message}`;
      default:
        return "Esperando conexión…";
    }
  })();

  // Status color
  const statusColor = (() => {
    if (expired) return "text-danger";
    switch (status.kind) {
      case "waiting":
        return "text-text-muted";
      case "connected":
        return "text-accent";
      case "completed":
        return "text-accent";
      case "error":
        return "text-danger";
      default:
        return "text-text-muted";
    }
  })();

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* ARIA live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusText}
      </div>

      <h3 className="text-sm font-mono uppercase tracking-[0.18em] text-text-dim">
        Escanea con tu teléfono
      </h3>

      {/* QR Code */}
      <div className="rounded-lg border border-border-strong bg-white p-4">
        {handoffUrl && !expired ? (
          <QRCodeSVG
            value={handoffUrl}
            size={200}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center">
            <span className="text-sm text-text-dim">—</span>
          </div>
        )}
      </div>

      {/* Countdown timer with progress bar */}
      {!expired && (
        <div className="w-full max-w-[232px] space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Tiempo restante</span>
            <span className="font-mono">{timeDisplay}</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-border-strong overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiempo restante para el código QR"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Connection status */}
      <p className={`text-sm font-medium ${statusColor}`}>
        {statusText}
      </p>

      {/* Expiration state */}
      {expired && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-text-dim text-center">
            El código ha expirado. Genera uno nuevo para continuar.
          </p>
          <button
            onClick={handleRegenerate}
            className="inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors border border-accent bg-accent/10 text-accent hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Generar nuevo código
          </button>
        </div>
      )}

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors border border-border-strong text-text-muted hover:text-text hover:border-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Cancelar
      </button>
    </div>
  );
}
