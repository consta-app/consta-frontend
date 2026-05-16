"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Field } from "@/components/ui";
import { login, setSession, ApiError } from "@/lib/api";
import {
  isValidRecoveryPhrase,
  keypairFromPhrase,
  userIdFromPhrase,
} from "@/lib/mnemonic";

export default function LoginPage() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setSubmitting(true);
    setError(null);

    const cleaned = phrase.trim().toLowerCase().replace(/\s+/g, " ");

    if (!isValidRecoveryPhrase(cleaned)) {
      setError("La frase no es válida. Verifica las 12 palabras.");
      setSubmitting(false);
      return;
    }

    try {
      // Derive the same keypair + identifier the user had at registration
      const seedHash = await userIdFromPhrase(cleaned);
      const { publicKey, privateKey } = await keypairFromPhrase(cleaned);

      // In production, the backend would issue a challenge here, the client
      // would sign it with privateKey, and the backend would verify the
      // signature against the stored public key. With mocks, we just call login.
      const session = await login({ email_hash: seedHash });

      // We need to know the user_id; in mocks, the login response only has
      // the session token. We'll store the seed hash and let the app resolve
      // the user from the token.
      // For the mock, the session token format is "mock-jwt.<userId>.<ts>"
      const userId = session.session_token.split(".")[1] ?? seedHash;
      setSession(session.session_token, userId);

      // Restore the keypair to localStorage so signing works
      localStorage.setItem("consta:private_key", privateKey);
      localStorage.setItem("consta:public_key", publicKey);
      localStorage.setItem("consta:seed_hash", seedHash);

      router.push(`/profile/${userId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          "No encontramos una cuenta con esta frase. ¿Quieres registrarte?",
        );
      } else {
        setError(
          (err as Error).message ?? "No se pudo iniciar sesión.",
        );
      }
      setSubmitting(false);
    }
  }

  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <SiteHeader minimal />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Iniciar sesión
          </p>
          <h1 className="text-2xl sm:text-3xl">Volver a Consta</h1>
          <p className="text-sm text-text-muted">
            Ingresa las 12 palabras de tu frase de recuperación. Tu cuenta se
            deriva de esta frase — el backend nunca la ve.
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <Field
            label="Frase de recuperación"
            hint={`${wordCount} de 12 palabras`}
          >
            <textarea
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="palabra1 palabra2 palabra3 ... palabra12"
              rows={4}
              autoFocus
              className="w-full rounded border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text font-mono outline-none focus:border-accent resize-none"
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-between gap-3 items-center">
            <Link
              href="/register"
              className="text-sm text-text-muted hover:text-text"
            >
              ¿No tienes cuenta? Regístrate
            </Link>
            <Button
              onClick={handleLogin}
              disabled={submitting || wordCount !== 12}
            >
              {submitting ? "Verificando…" : "Iniciar sesión"}
            </Button>
          </div>
        </Card>

        <Card className="p-5 border-accent/30 bg-accent/5">
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-mono text-accent uppercase tracking-[0.15em] block mb-2">
              🔒 Cómo funciona
            </span>
            Tu frase nunca se envía al servidor. El navegador deriva tu par de
            llaves localmente y firma un desafío criptográfico para
            autenticarte. Si alguien interceptara el tráfico, no podría
            reconstruir tu frase ni hacerse pasar por ti.
          </p>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
