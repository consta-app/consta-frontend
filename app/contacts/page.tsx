"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Card, Field, Input, Pill } from "@/components/ui";
import {
  createContact,
  listContacts,
  getCurrentUserId,
  ApiError,
  type ContactItem,
} from "@/lib/api";
import { sha256 } from "@/lib/crypto";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export default function ContactsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    const id = getCurrentUserId();
    setSignedIn(Boolean(id));
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked || !signedIn) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await listContacts();
        if (!cancelled) setContacts(res.contacts);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar tus contactos.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, signedIn]);

  function emailLooksValid(e: string) {
    return /.+@.+\..+/.test(e.trim());
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    setJustAdded(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const contactHash = await sha256(cleanEmail);
      const res = await createContact({
        contact_hash: contactHash,
        contact_name: name.trim() ? name.trim() : null,
      });
      const created: ContactItem = {
        id: res.contact_id,
        contact_name: name.trim() ? name.trim() : null,
        confirmed: res.confirmed,
        created_at: new Date().toISOString(),
      };
      setContacts((prev) => [...prev, created]);
      setJustAdded(name.trim() || cleanEmail);
      setEmail("");
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("Tu sesión expiró. Inicia sesión de nuevo.");
      } else {
        setFormError(
          (err as Error).message ?? "No se pudo agregar el contacto.",
        );
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
            Los contactos de alerta están atados a tu cuenta. Inicia sesión o
            regístrate para gestionarlos.
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
            Contactos de alerta
          </p>
          <h1 className="text-2xl sm:text-3xl">Quién recibe el aviso</h1>
          <p className="text-sm text-text-muted">
            Si dejas pasar el intervalo de check-in sin confirmar, Consta
            notifica automáticamente a estas personas. Recibirán un correo con
            el enlace público a tu última declaración firmada.
          </p>
        </div>

        <Card className="p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-text">Agregar un contacto</h2>
            <p className="text-xs text-text-dim">
              Su correo se hashea con SHA-256 antes de salir del navegador. El
              backend nunca ve el correo en claro.
            </p>
          </div>

          <Field
            label="Correo del contacto"
            hint="Recibirá un correo de confirmación. Solo después de confirmar podrá recibir alertas."
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amiga@ejemplo.org"
              disabled={submitting}
            />
          </Field>

          <Field label="Nombre para mostrar (opcional)">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Ana, abogada"
              disabled={submitting}
            />
          </Field>

          {formError && <p className="text-sm text-danger">{formError}</p>}
          {justAdded && (
            <p className="text-sm text-accent">
              ✓ Invitación enviada a {justAdded}. Espera la confirmación.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={submit}
              disabled={submitting || !emailLooksValid(email)}
            >
              {submitting ? "Enviando invitación…" : "Enviar invitación"}
            </Button>
          </div>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
              Tus contactos
            </h2>
            {!loading && contacts.length > 0 && (
              <Pill>
                {contacts.length} {contacts.length === 1 ? "persona" : "personas"}
              </Pill>
            )}
          </div>

          {loading && (
            <p className="font-mono text-sm text-text-dim">Cargando…</p>
          )}

          {loadError && !loading && (
            <Card className="p-6">
              <p className="text-sm text-danger">{loadError}</p>
            </Card>
          )}

          {!loading && !loadError && contacts.length === 0 && (
            <Card className="p-6 space-y-3">
              <p className="text-text">
                Todavía no tienes contactos configurados.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                Sin contactos no hay a quién avisar. Agregá al menos una
                persona de confianza para que el sistema de alertas tenga
                sentido. Las personas que agregues solo serán contactadas si un
                intervalo de check-in expira sin tu confirmación.
              </p>
            </Card>
          )}

          {!loading && contacts.length > 0 && (
            <Card className="divide-y divide-border">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-text">
                      {c.contact_name ?? (
                        <span className="text-text-dim italic">
                          Contacto sin nombre
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-dim font-mono">
                      Agregado {formatDate(c.created_at)}
                    </p>
                  </div>
                  {c.confirmed ? (
                    <span className="inline-flex items-center rounded-full border border-accent/60 bg-accent/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono text-accent">
                      ✓ Confirmado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-[#facc15]/60 bg-[#facc15]/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono text-[#facc15]">
                      ⏳ Pendiente
                    </span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
