"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, Pill, Mono } from "@/components/ui";
import { listDeclarations, getBitcoinStatus, type PublicDeclarationItem, type BitcoinStatusResponse } from "@/lib/api";

const domainLabels: Record<string, string> = {
  periodista: "Periodista",
  abogado: "Abogado",
  cientifico: "Científica/o",
  activista: "Activista",
  otro: "Otra/o",
};

const riskLabels: Record<string, { label: string; className: string }> = {
  bajo:  { label: "Riesgo bajo",  className: "border-text-dim text-text-dim" },
  medio: { label: "Riesgo medio", className: "border-yellow-600 text-yellow-500" },
  alto:  { label: "Riesgo alto",  className: "border-danger/60 text-danger" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DeclarationsPage() {
  const [declarations, setDeclarations] = useState<PublicDeclarationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bitcoinStatus, setBitcoinStatus] = useState<Record<string, BitcoinStatusResponse>>({});

  useEffect(() => {
    listDeclarations()
      .then(res => {
        setDeclarations(res.declarations);
        // Fire live OTS checks for all unconfirmed declarations in parallel
        res.declarations
          .filter(d => !d.blockchain_confirmed)
          .forEach(d => {
            getBitcoinStatus(d.id).then(status => {
              setBitcoinStatus(prev => ({ ...prev, [d.id]: status }));
            }).catch(() => {});
          });
      })
      .catch(() => setError("No se pudieron cargar las declaraciones."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Registro público
          </p>
          <h1 className="text-2xl sm:text-3xl">Declaraciones públicas</h1>
          <p className="text-sm text-text-muted">
            Declaraciones firmadas criptográficamente y ancladas en IPFS. Cada una
            es verificable de forma independiente.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-text-dim font-mono">Cargando…</p>
        )}

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {!loading && !error && declarations.length === 0 && (
          <p className="text-sm text-text-muted">
            Aún no hay declaraciones públicas registradas.
          </p>
        )}

        {!loading && !error && declarations.length > 0 && (
          <div className="space-y-3">
            {declarations.map(d => (
              <Link
                key={d.id}
                href={`/declaration/${d.id}/verify`}
                className="block group"
              >
                <Card className="p-4 sm:p-5 hover:border-accent/40 transition-colors space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-text text-sm font-medium group-hover:text-accent transition-colors">
                        {d.user_display}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Pill>{domainLabels[d.domain] ?? d.domain}</Pill>
                        {d.risk_level && (
                          <Pill className={riskLabels[d.risk_level]?.className}>
                            {riskLabels[d.risk_level]?.label}
                          </Pill>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-text-dim font-mono">{formatDate(d.created_at)}</p>
                      {(() => {
                        const live = bitcoinStatus[d.id];
                        const confirmed = live
                          ? live.status === "confirmed"
                          : d.blockchain_confirmed;
                        const checking = !live && !d.blockchain_confirmed;
                        if (confirmed) {
                          return <p className="text-xs text-accent font-mono">✓ Bitcoin</p>;
                        }
                        if (checking) {
                          return <p className="text-xs text-text-dim font-mono animate-pulse">⏳ …</p>;
                        }
                        return <p className="text-xs text-text-dim font-mono">⏳ Pendiente</p>;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Mono className="text-xs text-text-dim">{d.id}</Mono>
                    {d.verification_count > 0 && (
                      <span className="text-xs text-accent font-mono">
                        {d.verification_count} verificación{d.verification_count !== 1 ? "es" : ""}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
