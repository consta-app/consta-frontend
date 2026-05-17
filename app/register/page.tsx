"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Button,
  Card,
  Field,
  Input,
  Mono,
  Pill,
} from "@/components/ui";
import {
  register,
  login,
  challenge,
  verify,
  setSession,
  ApiError,
  USE_MOCKS,
  type Domain,
  type RiskLevel,
} from "@/lib/api";
import { signContent } from "@/lib/crypto";
import {
  generateRecoveryPhrase,
  keypairFromPhrase,
  userIdFromPhrase,
} from "@/lib/mnemonic";

type Step = 1 | 2 | 3 | 4;

const domainOptions: { value: Domain; label: string }[] = [
  { value: "periodista", label: "Periodista" },
  { value: "abogado", label: "Abogado" },
  { value: "cientifico", label: "Científica/o" },
  { value: "activista", label: "Activista" },
  { value: "otro", label: "Otra/o" },
];

const riskOptions: { value: RiskLevel; label: string; desc: string }[] = [
  { value: "bajo", label: "Bajo", desc: "Sin amenazas activas conocidas." },
  {
    value: "medio",
    label: "Medio",
    desc: "Exposición pública o trabajo sensible.",
  },
  {
    value: "alto",
    label: "Alto",
    desc: "Amenazas directas, hostigamiento o seguimiento.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [phrase, setPhrase] = useState<string>("");
  useEffect(() => { setPhrase(generateRecoveryPhrase()); }, []);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [domain, setDomain] = useState<Domain>("periodista");
  const [risk, setRisk] = useState<RiskLevel>("medio");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<{
    userId: string;
    publicKey: string;
  } | null>(null);

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      // Derive everything from the recovery phrase
      const seedHash = await userIdFromPhrase(phrase);
      const { publicKey, privateKey } = await keypairFromPhrase(phrase);

      const res = await register({
        email_hash: seedHash,
        public_key: publicKey,
        display_name: displayName.trim() ? displayName.trim() : null,
        domain,
        risk_level: risk,
      });

      let sessionToken: string;
      if (USE_MOCKS) {
        const session = await login({ email_hash: seedHash });
        sessionToken = session.session_token;
      } else {
        const { challenge: nonce } = await challenge({ email_hash: seedHash });
        const signature = await signContent(privateKey, nonce);
        const session = await verify({ email_hash: seedHash, challenge: nonce, signature });
        sessionToken = session.session_token;
      }
      setSession(sessionToken, res.user_id);

      localStorage.setItem("consta:private_key", privateKey);
      localStorage.setItem("consta:public_key", publicKey);
      localStorage.setItem("consta:seed_hash", seedHash);

      setDone({ userId: res.user_id, publicKey });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Esta frase ya está registrada. Intenta iniciar sesión.");
      } else {
        setError((err as Error).message ?? "No se pudo completar el registro.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const phraseWords = phrase.split(" ");

  return (
    <>
      <SiteHeader minimal />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Registro
          </p>
          <h1 className="text-2xl sm:text-3xl">Crear cuenta en Consta</h1>
          <p className="text-sm text-text-muted">
            Tu cuenta se identifica por una frase de 12 palabras. No pedimos
            correo, teléfono ni otros datos personales.
          </p>
        </div>

        {!done && (
          <>
            <ol className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-text-dim">
              <Pill className={step >= 1 ? "border-accent text-accent" : ""}>
                01 Frase
              </Pill>
              <span>—</span>
              <Pill className={step >= 2 ? "border-accent text-accent" : ""}>
                02 Confirmar
              </Pill>
              <span>—</span>
              <Pill className={step >= 3 ? "border-accent text-accent" : ""}>
                03 Perfil
              </Pill>
              <span>—</span>
              <Pill className={step >= 4 ? "border-accent text-accent" : ""}>
                04 Crear
              </Pill>
            </ol>

            {step === 1 && (
              <Card className="p-6 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-text">Tu frase de recuperación</h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Estas 12 palabras son tu única forma de volver a tu
                    cuenta. Anótalas en papel y guárdalas en un lugar seguro.
                    No las compartas con nadie.
                  </p>
                </div>

                <div className="rounded border border-accent/40 bg-accent/5 p-4">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {phraseWords.map((word, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded bg-bg-elevated px-2 py-1.5"
                      >
                        <span className="font-mono text-[10px] text-text-dim">
                          {(i + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="font-mono text-sm text-text">
                          {word}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-danger/40 bg-danger/5 p-4 text-sm text-text-muted leading-relaxed">
                  <p className="text-danger font-mono text-xs uppercase tracking-[0.15em] mb-2">
                    Importante
                  </p>
                  <p>
                    Si pierdes esta frase, pierdes el acceso a tu cuenta para
                    siempre. No hay recuperación por correo. Cualquier persona
                    con estas palabras puede hacerse pasar por ti.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(phrase);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      const el = document.createElement("textarea");
                      el.value = phrase;
                      el.style.position = "fixed";
                      el.style.opacity = "0";
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="text-sm text-text-muted hover:text-text underline"
                >
                  {copied ? "✓ Copiada" : "Copiar al portapapeles"}
                </button>

                <div className="flex justify-between gap-3">
                  <Link
                    href="/"
                    className="text-sm text-text-muted hover:text-text"
                  >
                    Cancelar
                  </Link>
                  <Button onClick={() => setStep(2)}>
                    Ya las anoté →
                  </Button>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card className="p-6 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-text">Confirma que las guardaste</h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Antes de continuar, asegúrate de tener las 12 palabras
                    escritas o guardadas en un lugar seguro fuera de este
                    dispositivo.
                  </p>
                </div>

                <label className="flex items-start gap-3 text-sm text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedSaved}
                    onChange={(e) => setConfirmedSaved(e.target.checked)}
                    className="mt-1 accent-[#4ade80]"
                  />
                  <span>
                    He guardado las 12 palabras en un lugar seguro. Entiendo
                    que sin ellas no puedo recuperar mi cuenta.
                  </span>
                </label>

                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    ← Volver a ver
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!confirmedSaved}
                  >
                    Siguiente →
                  </Button>
                </div>
              </Card>
            )}

            {step === 3 && (
              <Card className="p-6 space-y-6">
                <Field
                  label="Nombre público (opcional)"
                  hint="Si lo dejas vacío tu declaración aparecerá como Anónimo."
                >
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. María Solís"
                  />
                </Field>

                <Field label="Dominio">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {domainOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDomain(opt.value)}
                        className={`rounded border px-3 py-2 text-sm transition-colors ${
                          domain === opt.value
                            ? "border-accent text-accent"
                            : "border-border-strong text-text-muted hover:text-text"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Nivel de riesgo">
                  <div className="space-y-2">
                    {riskOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRisk(opt.value)}
                        className={`w-full rounded border px-4 py-3 text-left transition-colors ${
                          risk === opt.value
                            ? "border-accent"
                            : "border-border-strong hover:border-text-muted"
                        }`}
                      >
                        <span
                          className={`block text-sm ${
                            risk === opt.value ? "text-accent" : "text-text"
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="block text-xs text-text-dim mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    ← Atrás
                  </Button>
                  <Button onClick={() => setStep(4)}>Siguiente →</Button>
                </div>
              </Card>
            )}

            {step === 4 && (
              <Card className="p-6 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-text">Crear cuenta</h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Al continuar, tu navegador deriva un par de llaves Ed25519
                    a partir de tu frase. La clave pública se envía al backend
                    y queda asociada a tu cuenta. La clave privada se queda
                    solo en este navegador.
                  </p>
                </div>

                {error && <p className="text-sm text-danger">{error}</p>}

                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    ← Atrás
                  </Button>
                  <Button onClick={finish} disabled={submitting}>
                    {submitting ? "Creando cuenta…" : "Crear cuenta"}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {done && (
          <Card className="p-6 space-y-5 border-accent/40">
            <div className="space-y-2">
              <p className="text-accent text-sm font-mono uppercase tracking-[0.15em]">
                ✓ Cuenta creada
              </p>
              <h2 className="text-text">Bienvenida a Consta.</h2>
              <p className="text-sm text-text-muted">
                Recuerda: necesitarás tu frase de 12 palabras para volver a
                entrar desde otro dispositivo.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-text-dim font-mono uppercase tracking-[0.15em]">
                Identificador de usuario
              </p>
              <Mono>{done.userId}</Mono>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => router.push("/declaration/new")}>
                Crear mi primera declaración →
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/profile/${done.userId}`)}
              >
                Ver mi perfil
              </Button>
            </div>
          </Card>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
