"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserId, clearSession } from "@/lib/api";

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUserId(getCurrentUserId());
  }, []);

  function handleLogout() {
    clearSession();
    // Also clear the keypair from localStorage
    localStorage.removeItem("consta:private_key");
    localStorage.removeItem("consta:public_key");
    localStorage.removeItem("consta:seed_hash");
    setUserId(null);
    router.push("/");
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-xl tracking-tight text-text hover:text-accent transition-colors"
          style={{
            fontFamily: '"DejaVu Serif Condensed", "DejaVu Serif", serif',
            fontWeight: 700,
          }}
        >
          consta
        </Link>
        {!minimal && (
          <nav className="flex items-center gap-6 text-sm text-text-muted">
            <Link
              href="/declaration/new"
              className="hover:text-text transition-colors"
            >
              Nueva declaración
            </Link>
            <Link
              href="/checkin"
              className="hover:text-text transition-colors"
            >
              Check-in
            </Link>
            <Link
              href="/contacts"
              className="hover:text-text transition-colors"
            >
              Contactos
            </Link>
            {mounted && userId ? (
              <>
                <Link
                  href={`/profile/${userId}`}
                  className="hover:text-text transition-colors"
                >
                  Mi perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded border border-border-strong px-3 py-1.5 hover:border-danger hover:text-danger transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hover:text-text transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="rounded border border-border-strong px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
