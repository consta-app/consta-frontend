"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Mono, Pill } from "@/components/ui";
import {
  verifyDeclaration,
  type VerifyDeclarationResponse,
  ApiError,
} from "@/lib/api";
import { fetchFromIPFS } from "@/lib/ipfs";
import { sha256 } from "@/lib/crypto";

type IntegrityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; recomputed: string }
  | { status: "mismatch"; recomputed: string }
  | { status: "error"; message: string };

const domainLabels: Record<string, string> = {
  periodista: "Periodista",
  abogado: "Abogado",
  cientifico: "Científica/o",
  activista: "Activista",
  otro: "Otra/o",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function downloadBase64(b64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Reconstructs the deterministic TSQ (no nonce) from the content hash hex.
// Mirrors buildTSQ() in consta-backend/src/services/timestamp.js exactly.
function buildTSQ(hashHex: string): Uint8Array {
  const concat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) { out.set(p, offset); offset += p.length; }
    return out;
  };
  const tlv = (tag: number, content: Uint8Array) =>
    concat(new Uint8Array([tag, content.length]), content);

  const hashBytes = new Uint8Array(hashHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const sha256Oid = new Uint8Array([0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01]);
  const nullTag   = new Uint8Array([0x05, 0x00]);
  const algId     = tlv(0x30, concat(sha256Oid, nullTag));
  const hashOctet = tlv(0x04, hashBytes);
  const msgImp    = tlv(0x30, concat(algId, hashOctet));
  const version   = new Uint8Array([0x02, 0x01, 0x01]);
  const certReq   = new Uint8Array([0x01, 0x01, 0xff]);
  return tlv(0x30, concat(version, msgImp, certReq));
}

export default function VerifyDeclarationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] = useState<VerifyDeclarationResponse | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const meta = await verifyDeclaration(id);
        if (cancelled) return;
        setData(meta);
        const text = await fetchFromIPFS(meta.ipfs_cid);
        if (cancelled) return;
        setContent(text);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(
            err.status === 404
              ? "Esta declaración no existe o no es pública."
              : err.message,
          );
        } else {
          setError("No se pudo cargar la declaración.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function checkIntegrity() {
    if (!data || content == null) return;
    setIntegrity({ status: "checking" });
    try {
      const recomputed = await sha256(content);
      setIntegrity(
        recomputed === data.content_hash
          ? { status: "ok", recomputed }
          : { status: "mismatch", recomputed },
      );
    } catch (err) {
      setIntegrity({
        status: "error",
        message: (err as Error).message ?? "Error al calcular el hash.",
      });
    }
  }

  return (
    <>
      <SiteHeader minimal />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 space-y-10">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Verificación pública
          </p>
          <h1 className="text-2xl sm:text-3xl text-text">
            Declaración firmada criptográficamente
          </h1>
          <p className="text-sm text-text-muted">
            Esta página está abierta a cualquiera. No requiere cuenta. Su
            propósito es servir como evidencia pública, fechada e inmutable.
          </p>
        </div>

        {loading && (
          <p className="font-mono text-sm text-text-dim">
            Cargando declaración…
          </p>
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

        {data && content != null && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-text-dim font-mono uppercase tracking-[0.18em]">
                    Autor
                  </p>
                  <p className="text-text">
                    {data.user_display}{" "}
                    <span className="text-text-dim">
                      · {domainLabels[data.domain] ?? data.domain}
                    </span>
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-text-dim font-mono uppercase tracking-[0.18em]">
                    Fecha de firma
                  </p>
                  <p className="text-text-muted text-sm">
                    {formatDate(data.created_at)}
                  </p>
                </div>
              </div>
            </Card>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                Contenido de la declaración
              </h2>
              <Card className="p-6">
                <pre className="font-mono whitespace-pre-wrap text-sm leading-relaxed text-text">
{content}
                </pre>
              </Card>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                Pruebas criptográficas
              </h2>
              <Card className="divide-y divide-border">
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                  <span className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                    Hash SHA-256
                  </span>
                  <Mono>{data.content_hash}</Mono>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                  <span className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                    IPFS CID
                  </span>
                  <div className="space-y-2">
                    <Mono className="break-all">{data.ipfs_cid}</Mono>
                    <a
                      href={`https://cid.ipfs.tech/#${data.ipfs_cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                    >
                      Verificar CID externamente →
                    </a>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                  <span className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                    Timestamp RFC 3161
                  </span>
                  {data.timestamp_token ? (
                    <div className="space-y-2">
                      <Mono>{data.timestamp_token}</Mono>
                      <div className="flex flex-wrap gap-3">
                        <span
                          onClick={() => downloadBytes(buildTSQ(data.content_hash), `consta-${data.declaration_id}.tsq`, "application/timestamp-query")}
                          className="cursor-pointer text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                        >
                          Descargar .tsq →
                        </span>
                        <span
                          onClick={() => downloadBase64(data.timestamp_token, `consta-${data.declaration_id}.tsr`, "application/timestamp-reply")}
                          className="cursor-pointer text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                        >
                          Descargar .tsr →
                        </span>
                        <a
                          href="https://www.freetsa.org/index_en.php"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                        >
                          Verificar en FreeTSA →
                        </a>
                      </div>
                      <p className="text-xs text-text-dim">
                        En FreeTSA: sube el .tsq y el .tsr juntos.
                      </p>
                    </div>
                  ) : (
                    <Mono className="text-text-dim text-xs">No disponible</Mono>
                  )}
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                  <span className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                    Bitcoin (OTS)
                  </span>
                  <div className="space-y-2">
                    {data.blockchain_confirmed ? (
                      <span className="text-sm text-accent font-mono">✓ Anclada en Bitcoin</span>
                    ) : data.blockchain_tx ? (
                      <span className="text-sm text-yellow-500 font-mono">⏳ Pendiente de confirmación (~1 hora)</span>
                    ) : (
                      <span className="text-sm text-text-dim font-mono">Sin anclaje en blockchain</span>
                    )}
                    {data.blockchain_tx && (
                      <>
                        <Mono>{data.blockchain_tx}</Mono>
                        <div className="flex flex-wrap gap-3">
                          {content && (
                            <span
                              onClick={() => downloadText(content, `consta-${data.declaration_id}.txt`)}
                              className="cursor-pointer text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                            >
                              Descargar texto original →
                            </span>
                          )}
                          <span
                            onClick={() => downloadBase64(data.blockchain_tx, `consta-${data.declaration_id}.ots`, "application/octet-stream")}
                            className="cursor-pointer text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                          >
                            Descargar .ots →
                          </span>
                          <a
                            href="https://opentimestamps.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs font-mono text-text-muted hover:text-accent underline transition-colors"
                          >
                            Verificar en OpenTimestamps →
                          </a>
                        </div>
                        <p className="text-xs text-text-dim">
                          En OpenTimestamps: sube el texto original y el .ots juntos.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                  Verificar integridad
                </h2>
                <Button
                  onClick={checkIntegrity}
                  disabled={integrity.status === "checking"}
                >
                  {integrity.status === "checking"
                    ? "Calculando…"
                    : "Re-hashear y comparar"}
                </Button>
              </div>
              {integrity.status === "idle" && (
                <p className="text-sm text-text-muted">
                  Este botón vuelve a calcular el hash SHA-256 del contenido
                  cargado desde IPFS y lo compara con el hash registrado en el
                  backend. Si coinciden, el contenido no ha sido alterado.
                </p>
              )}
              {integrity.status === "ok" && (
                <Card className="p-4 border-accent/40">
                  <p className="text-sm text-accent">
                    ✓ Hash coincide. El contenido es íntegro.
                  </p>
                  <Mono className="mt-2 block text-accent/80">
                    {integrity.recomputed}
                  </Mono>
                </Card>
              )}
              {integrity.status === "mismatch" && (
                <Card className="p-4 border-danger/40">
                  <p className="text-sm text-danger">
                    ✗ Los hashes NO coinciden. El contenido ha sido alterado o
                    no corresponde al CID registrado.
                  </p>
                  <Mono className="mt-2 block">
                    recomputado: {integrity.recomputed}
                  </Mono>
                </Card>
              )}
              {integrity.status === "error" && (
                <p className="text-sm text-danger">{integrity.message}</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
                Verificaciones de identidad
              </h2>
              {data.verifications.length === 0 ? (
                <Card className="p-6">
                  <p className="text-sm text-text-muted">
                    Sin verificaciones de identidad todavía.
                  </p>
                </Card>
              ) : (
                <Card className="divide-y divide-border">
                  {data.verifications.map((v, i) => (
                    <div
                      key={i}
                      className="p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs text-accent"
                          aria-hidden
                        >
                          {v.type === "org" ? "◆" : "✓"}
                        </span>
                        <div className="space-y-1">
                          <p className="text-text text-sm">{v.name}</p>
                          <Pill className="border-accent/40 text-accent">
                            {v.type === "org" ? "Organización" : "Biométrica"}
                          </Pill>
                        </div>
                      </div>
                      <span className="text-xs text-text-dim font-mono">
                        {formatDate(v.at)}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
