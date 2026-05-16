"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Field, Pill } from "@/components/ui";
import {
  requestVerification,
  getMyVerifications,
  getPublicProfile,
  getCurrentUserId,
  ApiError,
  type MyVerificationItem,
} from "@/lib/api";
import { sha256 } from "@/lib/crypto";
import {
  createDiditSession,
  getDiditSessionStatus,
} from "@/lib/didit";

const alliedOrgs = [
  "CPJ — Committee to Protect Journalists",
  "Artículo 19",
  "Fundación por la Libertad de Prensa",
  "Front Line Defenders",
  "Comisión Interamericana de DDHH",
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

type CardState = {
  submitting: boolean;
  error: string | null;
  success: string | null;
};

const emptyCardState: CardState = {
  submitting: false,
  error: null,
  success: null,
};

export default function VerifyIdentityPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [latestDeclarationId, setLatestDeclarationId] = useState<string | null>(
    null,
  );
  const [hasDeclarations, setHasDeclarations] = useState<boolean | null>(null);
  const [verifications, setVerifications] = useState<MyVerificationItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [orgChoice, setOrgChoice] = useState(alliedOrgs[0]);
  const [orgState, setOrgState] = useState<CardState>(emptyCardState);

  useEffect(() => {
    const id = getCurrentUserId();
    setSignedIn(Boolean(id));
    setUserId(id);
    setAuthChecked(true);
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [profile, mine] = await Promise.all([
          getPublicProfile(id),
          getMyVerifications(),
        ]);
        if (cancelled) return;
        const decls = profile.declarations;
        setHasDeclarations(decls.length > 0);
        setLatestDeclarationId(decls[decls.length - 1]?.id ?? null);
        setVerifications(mine.verifications);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar tu estado de verificación.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const status: "verified" | "pending" | "unverified" = useMemo(() => {
    if (verifications.some((v) => v.status === "verified")) return "verified";
    if (verifications.some((v) => v.status === "pending")) return "pending";
    return "unverified";
  }, [verifications]);

  const verifiedBy = verifications.find((v) => v.status === "verified");

  async function sendOrg() {
    setOrgState({ submitting: true, error: null, success: null });
    try {
      const res = await requestVerification({
        declaration_id: latestDeclarationId ?? undefined,
        verifier_type: "org",
        org_name: orgChoice,
      });
      setVerifications((prev) => [
        ...prev,
        {
          id: res.verification_id,
          verifier_type: "org",
          verifier_name: orgChoice,
          status: res.status,
          created_at: res.created_at,
        },
      ]);
      setOrgState({
        submitting: false,
        error: null,
        success: `Solicitud enviada a ${orgChoice}.`,
      });
    } catch (err) {
      setOrgState({
        submitting: false,
        error:
          err instanceof ApiError
            ? err.message
            : "No se pudo enviar la solicitud.",
        success: null,
      });
    }
  }

  async function handleBiometricVerified(confidence: number, proof: string) {
    try {
      const res = await requestVerification({
        declaration_id: latestDeclarationId ?? undefined,
        verifier_type: "video",
        confidence,
        proof,
      });
      setVerifications((prev) => [
        ...prev,
        {
          id: res.verification_id,
          verifier_type: "video",
          verifier_name: "Verificación biométrica local",
          status: res.status,
          created_at: res.created_at,
        },
      ]);
    } catch (err) {
      throw new Error(
        err instanceof ApiError
          ? err.message
          : "No se pudo registrar la verificación.",
      );
    }
  }

  if (authChecked && !signedIn) {
    return (
      <>
        <SiteHeader minimal />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 space-y-6">
          <h1 className="text-2xl">Sesión requerida</h1>
          <p className="text-text-muted">
            Inicia sesión con tu frase de 12 palabras para verificar tu
            identidad.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push("/login")}>
              Iniciar sesión →
            </Button>
            <Button variant="secondary" onClick={() => router.push("/register")}>
              Crear cuenta
            </Button>
            <Link
              href="/"
              className="rounded border border-border-strong px-4 py-2 text-sm text-text-muted hover:text-text"
            >
              Volver al inicio
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 space-y-8">
        <Link
          href={userId ? `/profile/${userId}` : "/"}
          className="inline-flex items-center text-sm text-text-muted hover:text-accent transition-colors"
        >
          ← Volver a mi perfil
        </Link>

        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Verificación de identidad
          </p>
          <h1 className="text-2xl sm:text-3xl">Haz tu declaración más creíble</h1>
          <p className="text-sm text-text-muted">
            Una declaración firmada ya es evidencia técnica. Una verificación
            humana o biométrica le suma peso: si algún día tus palabras tienen
            que sostenerse ante terceros, una identidad confirmada las vuelve
            mucho más difíciles de descartar.
          </p>
        </div>

        {hasDeclarations === false && !loading && (
          <Card className="p-6 space-y-3 border-[#facc15]/40 bg-[#facc15]/5">
            <p className="text-[#facc15]">
              Primero necesitas crear una declaración.
            </p>
            <p className="text-sm text-text-muted">
              Las verificaciones se anclan a una declaración existente.
            </p>
            <Link
              href="/declaration/new"
              className="inline-block text-accent hover:underline"
            >
              Crear declaración →
            </Link>
          </Card>
        )}

        {hasDeclarations !== false && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 space-y-4 flex flex-col">
              <div className="space-y-1">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
                  01 · Organización
                </p>
                <h2 className="text-text">Verificación por una organización</h2>
                <p className="text-xs text-text-dim leading-relaxed">
                  Una organización aliada confirma tu identidad y trabajo.
                </p>
              </div>
              <Field label="Organización aliada">
                <select
                  value={orgChoice}
                  onChange={(e) => setOrgChoice(e.target.value)}
                  disabled={orgState.submitting}
                  className="w-full rounded border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
                >
                  {alliedOrgs.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              {orgState.error && (
                <p className="text-xs text-danger">{orgState.error}</p>
              )}
              {orgState.success && (
                <p className="text-xs text-accent">{orgState.success}</p>
              )}
              <Button
                onClick={sendOrg}
                disabled={orgState.submitting}
                className="mt-auto"
              >
                {orgState.submitting ? "Enviando…" : "Solicitar verificación"}
              </Button>
            </Card>

            <BiometricVerificationCard onVerified={handleBiometricVerified} />
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Tu estado de verificación
          </h2>

          {loading && (
            <p className="font-mono text-sm text-text-dim">Cargando…</p>
          )}

          {loadError && !loading && (
            <Card className="p-6">
              <p className="text-sm text-danger">{loadError}</p>
            </Card>
          )}

          {!loading && !loadError && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {status === "verified" && (
                  <span className="inline-flex items-center rounded-full border border-accent/60 bg-accent/10 px-3 py-1 text-xs uppercase tracking-[0.15em] font-mono text-accent">
                    ✓ Verificado
                  </span>
                )}
                {status === "pending" && (
                  <span className="inline-flex items-center rounded-full border border-[#facc15]/60 bg-[#facc15]/10 px-3 py-1 text-xs uppercase tracking-[0.15em] font-mono text-[#facc15]">
                    ⏳ Verificación pendiente
                  </span>
                )}
                {status === "unverified" && (
                  <span className="inline-flex items-center rounded-full border border-border-strong px-3 py-1 text-xs uppercase tracking-[0.15em] font-mono text-text-muted">
                    Sin verificar
                  </span>
                )}
                {verifiedBy && (
                  <p className="text-xs text-text-muted">
                    por <span className="text-text">{verifiedBy.verifier_name}</span>
                  </p>
                )}
              </div>

              {verifications.length > 0 && (
                <ul className="divide-y divide-border border border-border rounded">
                  {verifications.map((v) => (
                    <li
                      key={v.id}
                      className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-text">{v.verifier_name}</p>
                        <Pill>
                          {v.verifier_type === "org" ? "Organización" : "Biométrica"}
                        </Pill>
                      </div>
                      <div className="flex items-center gap-3">
                        {v.status === "verified" ? (
                          <span className="font-mono text-xs text-accent uppercase tracking-[0.15em]">
                            Verificado
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-[#facc15] uppercase tracking-[0.15em]">
                            Pendiente
                          </span>
                        )}
                        <span className="text-xs text-text-dim font-mono">
                          {formatDate(v.created_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tarjeta de verificación de identidad via Didit.
//
// Didit maneja: captura de documento, liveness, face match.
// El flujo es: crear sesión → mostrar iframe de Didit → poll resultado.
// ───────────────────────────────────────────────────────────────────────────

type DiditCardState =
  | { kind: "idle" }
  | { kind: "creating-session" }
  | { kind: "verifying"; sessionId: string; verificationUrl: string }
  | { kind: "polling"; sessionId: string }
  | { kind: "approved" }
  | { kind: "declined"; message: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 3000;

function BiometricVerificationCard({
  onVerified,
}: {
  onVerified: (confidence: number, proof: string) => Promise<void>;
}) {
  const [state, setState] = useState<DiditCardState>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function startVerification() {
    setState({ kind: "creating-session" });
    try {
      const session = await createDiditSession();
      setState({
        kind: "verifying",
        sessionId: session.session_id,
        verificationUrl: session.verification_url,
      });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "No se pudo iniciar la verificación.",
      });
    }
  }

  // Start polling when in "verifying" state
  useEffect(() => {
    if (state.kind !== "verifying") return;
    const { sessionId } = state;

    pollRef.current = setInterval(async () => {
      try {
        const status = await getDiditSessionStatus(sessionId);
        if (status === "Approved") {
          stopPolling();
          setState({ kind: "polling", sessionId });
          // Generate a proof hash from the session ID + timestamp
          const proof = await sha256(`didit:${sessionId}:${Date.now()}`);
          try {
            await onVerified(1.0, proof);
            setState({ kind: "approved" });
          } catch (err) {
            setState({
              kind: "error",
              message: (err as Error).message ?? "No se pudo registrar.",
            });
          }
        } else if (status === "Declined") {
          stopPolling();
          setState({
            kind: "declined",
            message: "La verificación fue rechazada. Intenta de nuevo con un documento válido.",
          });
        } else if (status === "Expired" || status === "Abandoned") {
          stopPolling();
          setState({
            kind: "error",
            message: "La sesión expiró. Intenta de nuevo.",
          });
        }
      } catch {
        // Ignore polling errors, keep trying
      }
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [state.kind, state.kind === "verifying" ? state.sessionId : null, onVerified, stopPolling]);

  function reset() {
    stopPolling();
    setState({ kind: "idle" });
  }

  return (
    <Card
      className={`p-5 space-y-4 flex flex-col ${
        state.kind === "verifying" ? "sm:col-span-2" : ""
      }`}
      aria-label="Verificación de identidad"
    >
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
          02 · Identidad · Verificación biométrica
        </p>
        <h2 className="text-text">Verifica tu identidad</h2>
      </div>

      <div className="rounded border border-accent/30 bg-accent/10 p-3 text-sm text-accent space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.15em]">
          🔒 Verificación segura
        </p>
        <p className="text-sm leading-relaxed">
          La verificación compara tu rostro con la foto de tu documento de
          identidad. El proceso es rápido y seguro.
        </p>
      </div>

      {state.kind === "idle" && (
        <>
          <p className="text-xs text-text-dim leading-relaxed">
            Necesitarás tu pasaporte o documento de identidad y acceso a la
            cámara para una verificación rápida de vida.
          </p>
          <Button onClick={startVerification} className="mt-auto">
            Iniciar verificación
          </Button>
        </>
      )}

      {state.kind === "creating-session" && (
        <div className="flex items-center gap-3 mt-auto" role="status">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-mono text-sm text-text-dim">
            Preparando verificación…
          </span>
        </div>
      )}

      {state.kind === "verifying" && (
        <>
          <div className="w-full overflow-x-auto rounded-lg border border-border">
            <iframe
              ref={iframeRef}
              src={state.verificationUrl}
              className="border-0"
              style={{ width: "100%", minWidth: "380px", height: "650px" }}
              allow="camera; microphone; fullscreen; autoplay; encrypted-media"
              title="Verificación de identidad Didit"
            />
          </div>
          <p className="text-xs text-text-dim text-center">
            Completa la verificación en la ventana de arriba. Sigue las
            instrucciones para capturar tu documento y selfie.
          </p>
        </>
      )}

      {state.kind === "polling" && (
        <div className="flex items-center gap-3 mt-auto" role="status">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-mono text-sm text-text-dim">
            Procesando resultado…
          </span>
        </div>
      )}

      {state.kind === "approved" && (
        <div className="text-center space-y-2 py-4 mt-auto">
          <p className="text-4xl text-accent">✓</p>
          <p className="text-accent font-mono text-sm uppercase tracking-[0.15em]">
            Identidad verificada
          </p>
        </div>
      )}

      {state.kind === "declined" && (
        <>
          <p className="text-sm text-danger" role="alert">{state.message}</p>
          <Button onClick={startVerification} variant="secondary" className="mt-auto">
            Reintentar
          </Button>
        </>
      )}

      {state.kind === "error" && (
        <>
          <p className="text-sm text-danger" role="alert">{state.message}</p>
          <Button onClick={reset} variant="secondary" className="mt-auto">
            Empezar de nuevo
          </Button>
        </>
      )}
    </Card>
  );
}
