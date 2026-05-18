"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserId, clearSession } from "@/lib/api";

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showLogoConfirm, setShowLogoConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUserId(getCurrentUserId());
  }, []);

  function handleLogout() {
    clearSession();
    localStorage.removeItem("consta:private_key");
    localStorage.removeItem("consta:public_key");
    localStorage.removeItem("consta:seed_hash");
    setUserId(null);
    setMenuOpen(false);
    router.push("/");
  }

  function handleLogoConfirm() {
    handleLogout();
    setShowLogoConfirm(false);
  }

  return (
    <>
    {showLogoConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="w-full max-w-sm rounded border border-border-strong bg-bg p-6 space-y-4">
          <p className="text-text text-sm leading-relaxed">
            ¿Salir al inicio? Esto cerrará tu sesión. Podrás volver con tu frase de 12 palabras.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowLogoConfirm(false)}
              className="rounded border border-border-strong px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleLogoConfirm}
              className="rounded border border-danger/60 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    )}
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        {mounted && userId ? (
          <button
            onClick={() => setShowLogoConfirm(true)}
            className="text-xl tracking-tight text-text hover:text-accent transition-colors"
            style={{
              fontFamily: '"DejaVu Serif Condensed", "DejaVu Serif", serif',
              fontWeight: 700,
            }}
          >
            consta
          </button>
        ) : (
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
        )}
        {!minimal && (
          <>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-text-muted">
              <Link href="/declaration/new" className="hover:text-text transition-colors">
                Nueva declaración
              </Link>
              <Link href="/checkin" className="hover:text-text transition-colors">
                Check-in
              </Link>
              <Link href="/contacts" className="hover:text-text transition-colors">
                Contactos
              </Link>
              {mounted && userId ? (
                <>
                  <Link href={`/profile/${userId}`} className="hover:text-text transition-colors">
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
                  <Link href="/login" className="hover:text-text transition-colors">
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

            {/* Mobile hamburger button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col justify-center gap-1.5 p-1 text-text-muted hover:text-text transition-colors"
              aria-label="Menú"
            >
              <span className={`block h-px w-5 bg-current transition-transform origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block h-px w-5 bg-current transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-px w-5 bg-current transition-transform origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {!minimal && menuOpen && (
        <div className="md:hidden border-t border-border bg-bg">
          <nav className="mx-auto max-w-5xl px-6 py-4 flex flex-col gap-4 text-sm text-text-muted">
            <Link href="/declaration/new" onClick={() => setMenuOpen(false)} className="hover:text-text transition-colors">
              Nueva declaración
            </Link>
            <Link href="/checkin" onClick={() => setMenuOpen(false)} className="hover:text-text transition-colors">
              Check-in
            </Link>
            <Link href="/contacts" onClick={() => setMenuOpen(false)} className="hover:text-text transition-colors">
              Contactos
            </Link>
            {mounted && userId ? (
              <>
                <Link href={`/profile/${userId}`} onClick={() => setMenuOpen(false)} className="hover:text-text transition-colors">
                  Mi perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left rounded border border-border-strong px-3 py-2 text-danger hover:bg-danger/10 transition-colors w-fit"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="hover:text-text transition-colors">
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="rounded border border-border-strong px-3 py-2 hover:border-accent hover:text-accent transition-colors w-fit"
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
