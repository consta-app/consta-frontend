"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui";
import { confirmContact, ApiError } from "@/lib/api";

type State = "loading" | "success" | "error";

function ConfirmContent() {
  const params = useSearchParams();
  const token = params.get("token");

  const [state, setState] = useState<State>("loading");
  const [contactName, setContactName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("No se encontró un token de confirmación en el enlace.");
      setState("error");
      return;
    }

    confirmContact(token)
      .then((res) => {
        setContactName(res.contact_name);
        setState("success");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setErrorMsg("El enlace ya fue usado o no es válido.");
        } else {
          setErrorMsg((err as Error).message ?? "No se pudo confirmar.");
        }
        setState("error");
      });
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-20 space-y-6">
      {state === "loading" && (
        <p className="font-mono text-sm text-text-dim">Confirmando…</p>
      )}

      {state === "success" && (
        <Card className="p-8 space-y-4 border-accent/40">
          <p className="text-accent font-mono text-xs uppercase tracking-[0.15em]">
            ✓ Confirmado
          </p>
          <h1 className="text-2xl text-text">
            {contactName
              ? `Gracias, ${contactName}.`
              : "Gracias por confirmar."}
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Ahora eres contacto de alerta en Consta. Si la persona que te
            agregó no hace check-in en el tiempo acordado, recibirás un
            correo automático para que puedas verificar su bienestar.
          </p>
          <p className="text-xs text-text-dim">
            No necesitas una cuenta en Consta para este rol.
          </p>
        </Card>
      )}

      {state === "error" && (
        <Card className="p-8 space-y-4 border-danger/40">
          <p className="text-danger font-mono text-xs uppercase tracking-[0.15em]">
            Error
          </p>
          <h1 className="text-2xl text-text">No se pudo confirmar</h1>
          <p className="text-sm text-text-muted">{errorMsg}</p>
          <Link
            href="/"
            className="inline-block text-sm text-text-muted hover:text-text underline"
          >
            Ir al inicio
          </Link>
        </Card>
      )}
    </main>
  );
}

export default function ConfirmContactPage() {
  return (
    <>
      <SiteHeader minimal />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-lg flex-1 px-6 py-20">
            <p className="font-mono text-sm text-text-dim">Cargando…</p>
          </main>
        }
      >
        <ConfirmContent />
      </Suspense>
      <SiteFooter />
    </>
  );
}
