"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Pill } from "@/components/ui";
import {
  checkin,
  getCurrentUserId,
  getPublicProfile,
  ApiError,
} from "@/lib/api";

const intervals = [7, 14, 30, 60];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string): number {
  // Redondeo hacia arriba para que "menos de un día" no se vea como 0.
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function CheckinPage() {
  const router = useRouter();
  const [interval, setIntervalDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [done, setDone] = useState<{
    next_checkin_due: string;
    alert_sent: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextDue, setNextDue] = useState<string | null>(null);

  useEffect(() => {
    const id = getCurrentUserId();
    setSignedIn(Boolean(id));
    setAuthChecked(true);
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getPublicProfile(id);
        if (!cancelled) setNextDue(profile.next_due);
      } catch {
        // Si no se puede leer el perfil dejamos el bloque oculto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await checkin({ interval_days: interval });
      setDone(res);
      setNextDue(res.next_checkin_due);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Tu sesión expiró. Inicia sesión de nuevo.");
      } else {
        setError((err as Error).message ?? "No se pudo confirmar el check-in.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authChecked && !signedIn) {
    return (
      <>
        <SiteHeader minimal />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 space-y-6">
          <h1 className="text-2xl">Sesión requerida</h1>
          <p className="text-text-muted">
            El check-in confirma que sigues bien. Necesitamos tu sesión para
            registrarlo en tu cuenta.
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
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Check-in
          </p>
          <h1 className="text-2xl sm:text-3xl">Confirmar que estoy bien</h1>
          <p className="text-sm text-text-muted">
            Una sola acción. Si pasa el intervalo sin un nuevo check-in,
            Consta notifica a tus contactos de alerta.
          </p>
        </div>

        {done ? (
          <Card className="p-6 space-y-4 border-accent/40">
            <p className="text-accent font-mono text-sm uppercase tracking-[0.15em]">
              ✓ Check-in registrado
            </p>
            <p className="text-text">
              Próximo check-in antes del{" "}
              <span className="text-accent">
                {formatDate(done.next_checkin_due)}
              </span>
              .
            </p>
            {done.alert_sent && (
              <p className="text-sm text-danger">
                Ya se había enviado una alerta. Tus contactos serán informados
                de que estás bien.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDone(null)}>
                Hacer otro check-in
              </Button>
              <Link
                href="/"
                className="rounded border border-border-strong px-4 py-2 text-sm text-text-muted hover:text-text"
              >
                Volver al inicio
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-6">
            {nextDue && (() => {
              const remaining = daysUntil(nextDue);
              const overdue = remaining < 0;
              return (
                <div className="rounded border border-border bg-bg p-4 space-y-1">
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-dim">
                    Próximo check-in
                  </p>
                  <p className="text-text text-sm">{formatDate(nextDue)}</p>
                  <p
                    className={`font-mono text-xs ${
                      overdue
                        ? "text-danger"
                        : remaining <= 3
                          ? "text-[#facc15]"
                          : "text-accent"
                    }`}
                  >
                    {overdue
                      ? `Vencido hace ${Math.abs(remaining)} ${
                          Math.abs(remaining) === 1 ? "día" : "días"
                        }`
                      : remaining === 0
                        ? "Vence hoy"
                        : `${remaining} ${remaining === 1 ? "día restante" : "días restantes"}`}
                  </p>
                </div>
              );
            })()}

            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-dim">
                Intervalo
              </p>
              <div className="grid grid-cols-4 gap-2">
                {intervals.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setIntervalDays(days)}
                    className={`rounded border px-3 py-3 text-sm font-mono transition-colors ${
                      interval === days
                        ? "border-accent text-accent"
                        : "border-border-strong text-text-muted hover:text-text"
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-dim">
                Si no haces check-in en {interval} días, se dispara el flujo
                de alerta.
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full py-4 text-base"
            >
              {submitting ? "Registrando…" : "Estoy bien · Confirmar"}
            </Button>

            <div className="flex items-center justify-between text-xs text-text-dim font-mono">
              <span>Una sola acción · sin pasos</span>
              <Pill>autenticado</Pill>
            </div>
          </Card>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
