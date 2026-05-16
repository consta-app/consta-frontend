"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Mono, Pill } from "@/components/ui";
import {
  getPublicProfile,
  getMyVerifications,
  getCurrentUserId,
  type PublicProfileResponse,
  ApiError,
} from "@/lib/api";

const domainLabels: Record<string, string> = {
  periodista: "Periodista",
  abogado: "Abogado",
  cientifico: "Científica/o",
  activista: "Activista",
  otro: "Otra/o",
};

const riskLabels: Record<string, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

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

function relativeDays(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days > 0) return `hace ${days} días`;
  return `en ${Math.abs(days)} días`;
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [hasVerifications, setHasVerifications] = useState<boolean | null>(
    null,
  );

  // La declaración más reciente es la que vale como evidencia: la más fresca
  // y la que tiene el último timestamp.
  const latestDeclarationId = profile?.declarations?.[
    profile.declarations.length - 1
  ]?.id;

  const shareUrl =
    typeof window !== "undefined" && latestDeclarationId
      ? `${window.location.origin}/declaration/${latestDeclarationId}/verify`
      : latestDeclarationId
        ? `/declaration/${latestDeclarationId}/verify`
        : null;

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Si el navegador bloquea el clipboard simplemente mostramos la URL
      // en pantalla para copia manual.
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const own = getCurrentUserId() === id;
    setIsOwnProfile(own);
    (async () => {
      try {
        const res = await getPublicProfile(id);
        if (!cancelled) setProfile(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Este perfil no existe.");
        } else {
          setError("No se pudo cargar el perfil.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Solo consultamos verificaciones cuando es el propio perfil — el endpoint
    // requiere sesión y solo afecta al banner amarillo.
    if (own) {
      (async () => {
        try {
          const v = await getMyVerifications();
          if (!cancelled) setHasVerifications(v.verifications.length > 0);
        } catch {
          if (!cancelled) setHasVerifications(null);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Perfil público
          </p>
          <h1 className="text-2xl sm:text-3xl">
            {profile?.display_name ?? (loading ? "…" : "Anónimo")}
          </h1>
        </div>

        {loading && (
          <p className="font-mono text-sm text-text-dim">Cargando…</p>
        )}

        {error && (
          <Card className="p-6">
            <p className="text-sm text-danger">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-text-muted hover:text-accent"
            >
              ← Volver al inicio
            </Link>
          </Card>
        )}

        {profile && (
          <>
            <Card className="p-6 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                  Dominio
                </p>
                <p className="text-text mt-1">
                  {domainLabels[profile.domain] ?? profile.domain}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                  Nivel de riesgo
                </p>
                <p className="text-text mt-1">
                  {riskLabels[profile.risk_level] ?? profile.risk_level}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                  Verificado
                </p>
                <p className="mt-1">
                  {profile.verified ? (
                    <span className="text-accent">Sí</span>
                  ) : (
                    <span className="text-text-muted">No</span>
                  )}
                </p>
              </div>
            </Card>

            <Card className="p-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                  Último check-in
                </p>
                <p className="text-text mt-1">
                  {profile.last_checkin
                    ? formatDate(profile.last_checkin)
                    : "Sin check-ins"}
                </p>
                <p className="text-xs text-text-dim mt-1">
                  {relativeDays(profile.last_checkin)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                  Próximo check-in
                </p>
                <p className="text-text mt-1">
                  {profile.next_due ? formatDate(profile.next_due) : "—"}
                </p>
                <p className="text-xs text-text-dim mt-1">
                  {profile.next_due
                    ? relativeDays(profile.next_due)
                    : "Sin intervalo configurado"}
                </p>
              </div>
            </Card>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                Declaraciones públicas
              </h2>
              {profile.declarations.length === 0 ? (
                <Card className="p-6">
                  <p className="text-sm text-text-muted">
                    Este usuario aún no tiene declaraciones públicas.
                  </p>
                </Card>
              ) : (
                <Card className="divide-y divide-border">
                  {profile.declarations.map((d) => (
                    <Link
                      key={d.id}
                      href={`/declaration/${d.id}/verify`}
                      className="p-4 flex flex-wrap items-center justify-between gap-2 hover:bg-bg transition-colors"
                    >
                      <div className="space-y-1">
                        <Mono className="text-text">{d.id}</Mono>
                        <p className="text-xs text-text-dim">
                          {formatDate(d.created_at)}
                        </p>
                      </div>
                      <Pill>verificable →</Pill>
                    </Link>
                  ))}
                </Card>
              )}
            </section>

            {isOwnProfile && hasVerifications === false && (
              <Card className="p-6 space-y-4 border-[#facc15]/40 bg-[#facc15]/5">
                <div className="space-y-1">
                  <p className="text-[#facc15] text-sm">
                    ⚠ Tu declaración no tiene verificación de identidad.
                  </p>
                  <p className="text-sm text-text-muted">
                    Una verificación le da más peso como evidencia.
                  </p>
                </div>
                <div>
                  <Button onClick={() => router.push("/verify-identity")}>
                    Verificar ahora →
                  </Button>
                </div>
              </Card>
            )}

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                Compartir este perfil
              </h2>
              <Card className="p-6 space-y-4 border-accent/30">
                {shareUrl ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                        Enlace de verificación pública
                      </p>
                      <Mono className="block text-text">{shareUrl}</Mono>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={copyShareLink}>
                        {copied ? "✓ Copiado" : "Copiar enlace"}
                      </Button>
                      <p className="text-xs text-text-dim leading-relaxed">
                        Comparte este enlace con personas de confianza. Si algo
                        te pasa, este enlace es la evidencia.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    Este perfil aún no tiene declaraciones públicas para
                    compartir.
                  </p>
                )}
              </Card>
            </section>

            <div className="text-xs text-text-dim font-mono">
              user_id: <Mono>{profile.user_id}</Mono>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
