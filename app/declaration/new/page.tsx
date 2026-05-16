"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Field, Mono, Pill, Textarea } from "@/components/ui";
import {
  createDeclaration,
  getCurrentUserId,
  ApiError,
} from "@/lib/api";
import { sha256, signContent } from "@/lib/crypto";
import { uploadToIPFS } from "@/lib/ipfs";

type Stage =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "hashing" }
  | { kind: "signing" }
  | { kind: "publishing" }
  | { kind: "error"; message: string }
  | {
      kind: "done";
      declarationId: string;
      contentHash: string;
      ipfsCid: string;
      timestampToken: string;
      blockchainTx: string;
    };

const stageCopy: Record<string, string> = {
  uploading: "Subiendo el texto a IPFS…",
  hashing: "Calculando hash SHA-256…",
  signing: "Firmando con tu clave Ed25519…",
  publishing: "Registrando en el backend…",
};

const DECLARATION_TEMPLATE = `Yo, [nombre o seudónimo], declaro en esta fecha que estoy en buen estado de salud y que no tengo intención de hacerme daño. Hago esta declaración libremente y por mi propia voluntad. Si algo me sucediera contrario a este testimonio, pido que se investigue a fondo.

Soy [rol] y actualmente trabajo en [descripción general de mi trabajo]. Mis contactos de confianza han sido notificados de esta declaración.`;

export default function NewDeclarationPage() {
  const router = useRouter();
  const [text, setText] = useState(DECLARATION_TEMPLATE);
  const [isPublic, setIsPublic] = useState(true);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getCurrentUserId()));
    setAuthChecked(true);
  }, []);

  async function publish() {
    const privateKey = localStorage.getItem("consta:private_key");
    if (!privateKey) {
      setStage({
        kind: "error",
        message:
          "No encontramos una clave privada en este navegador. Regístrate primero.",
      });
      return;
    }
    if (!text.trim()) return;

    try {
      setStage({ kind: "uploading" });
      const cid = await uploadToIPFS(text);

      setStage({ kind: "hashing" });
      const contentHash = await sha256(text);

      setStage({ kind: "signing" });
      const signature = await signContent(privateKey, contentHash);

      setStage({ kind: "publishing" });
      const res = await createDeclaration({
        content_hash: contentHash,
        ipfs_cid: cid,
        signature,
        is_public: isPublic,
      });

      setStage({
        kind: "done",
        declarationId: res.declaration_id,
        contentHash,
        ipfsCid: cid,
        timestampToken: res.timestamp_token,
        blockchainTx: res.blockchain_tx,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStage({
          kind: "error",
          message: "Tu sesión expiró. Inicia sesión de nuevo.",
        });
      } else {
        setStage({
          kind: "error",
          message: (err as Error).message ?? "Algo falló al publicar.",
        });
      }
    }
  }

  const busy =
    stage.kind === "uploading" ||
    stage.kind === "hashing" ||
    stage.kind === "signing" ||
    stage.kind === "publishing";

  if (authChecked && !signedIn && stage.kind !== "done") {
    return (
      <>
        <SiteHeader minimal />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 space-y-6">
          <h1 className="text-2xl">Necesitas iniciar sesión</h1>
          <p className="text-text-muted">
            Para crear una declaración firmada necesitamos tu par de llaves.
            Inicia sesión con tu frase de 12 palabras o crea una cuenta nueva.
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
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Nueva declaración
          </p>
          <h1 className="text-2xl sm:text-3xl">Escribe tu declaración</h1>
          <p className="text-sm text-text-muted">
            El texto se sube a IPFS, se hashea con SHA-256 y se firma con tu
            clave privada. Después se registra en el backend y queda
            verificable públicamente por su ID.
          </p>
        </div>

        {stage.kind !== "done" && (
          <Card className="p-6 space-y-6">
            <div className="rounded border border-accent/40 bg-accent/5 p-4 space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
                Antes de firmar
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                Esta declaración será firmada criptográficamente con tu clave
                privada, marcada temporalmente y almacenada de forma
                permanente. No se puede editar ni eliminar después de firmar.
              </p>
            </div>

            <Field
              label="Texto de la declaración"
              hint="Edita la plantilla con tus datos. Incluye tu nombre, rol, contexto, y la afirmación explícita de que no tienes intención de hacerte daño."
            >
              <Textarea
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Yo, [nombre], [rol] en [lugar], declaro que...`}
                disabled={busy}
              />
            </Field>

            <label className="flex items-start gap-3 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={busy}
                className="mt-1 accent-[#4ade80]"
              />
              <span>
                <span className="block text-text">Hacer pública</span>
                <span className="block text-xs text-text-dim">
                  Cualquiera con el enlace podrá verificarla. Si la dejas
                  privada, solo aparece para ti.
                </span>
              </span>
            </label>

            <details className="rounded border border-border bg-bg p-4 text-sm">
              <summary className="cursor-pointer text-text-muted">
                Preview de cómo se verá públicamente
              </summary>
              <div className="mt-4 space-y-3">
                <pre className="font-mono whitespace-pre-wrap text-text">
{text || "(escribe algo arriba para ver el preview)"}
                </pre>
              </div>
            </details>

            {stage.kind === "error" && (
              <p className="text-sm text-danger">{stage.message}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-dim">
                {busy ? stageCopy[stage.kind] : "Listo para firmar"}
              </p>
              <Button
                onClick={publish}
                disabled={busy || !text.trim()}
              >
                {busy ? "Procesando…" : "Firmar y publicar"}
              </Button>
            </div>
          </Card>
        )}

        {stage.kind === "done" && (
          <div className="space-y-6">
            <Card className="p-6 space-y-5 border-accent/40">
              <div className="space-y-2">
                <p className="text-accent text-sm font-mono uppercase tracking-[0.15em]">
                  ✓ Declaración firmada
                </p>
                <h2 className="text-text">Tu declaración fue registrada.</h2>
              </div>

              <div className="space-y-3">
                <Field label="ID de declaración">
                  <Mono>{stage.declarationId}</Mono>
                </Field>
                <Field label="Hash SHA-256">
                  <Mono>{stage.contentHash}</Mono>
                </Field>
                <Field label="IPFS CID">
                  <Mono>{stage.ipfsCid}</Mono>
                </Field>
                <Field label="Timestamp RFC 3161">
                  <Mono>{stage.timestampToken}</Mono>
                </Field>
                <Field label="Blockchain tx">
                  <Mono>{stage.blockchainTx}</Mono>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    router.push(`/declaration/${stage.declarationId}/verify`)
                  }
                >
                  Ver página pública →
                </Button>
                <Pill>visible para cualquiera con el enlace</Pill>
              </div>
            </Card>

            <Card className="p-6 space-y-5 border-accent/40 bg-accent/5">
              <div className="space-y-2">
                <p className="text-accent text-sm font-mono uppercase tracking-[0.15em]">
                  Siguiente paso
                </p>
                <h2 className="text-text">Verifica tu identidad</h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  Tu declaración existe y está firmada. Verificar tu identidad
                  le da peso legal y credibilidad ante periodistas, familiares
                  y autoridades. Toma menos de 2 minutos.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/verify-identity")}>
                  Verificar identidad ahora →
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const id = getCurrentUserId();
                    router.push(id ? `/profile/${id}` : "/");
                  }}
                >
                  Hacerlo después
                </Button>
              </div>

              <p className="text-xs text-text-dim">
                Puedes verificar tu identidad en cualquier momento desde tu
                perfil.
              </p>
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
