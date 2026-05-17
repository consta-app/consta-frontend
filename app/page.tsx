import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { HeroBackground } from "@/components/hero-background";

function HeroContent({ isMasked }: { isMasked?: boolean }) {
  return (
    <div className="relative w-full space-y-8 px-6">
      {/* Centered Track Info */}
      <div className={`text-center w-full mb-40 -mt-32 ${isMasked ? 'invisible' : ''}`}>
        <p className="inline-block font-mono text-xs uppercase tracking-[0.3em] text-text-dim backdrop-blur-[2px] bg-black/40 px-3 py-1 rounded border border-white/5 shadow-sm">
          Hack@Latam · Track DEF/ACC
        </p>
      </div>

      <div className="max-w-2xl space-y-6 text-left">
        {/* Title Section */}
        <h1 
          className={`inline-block text-5xl sm:text-7xl tracking-tight backdrop-blur-[4px] bg-black/20 px-3 py-1 rounded-xl border border-white/5 shadow-xl transition-opacity duration-300 ${!isMasked ? 'opacity-[0.15]' : ''}`}
          style={{ fontFamily: '"DejaVu Serif Condensed", "DejaVu Serif", serif', fontWeight: 700 }}
        >
          Consta
        </h1>

        {/* Description Section */}
        <div className="space-y-3">
          <div>
            <p className={`inline-block text-lg sm:text-xl text-text font-medium backdrop-blur-[2px] bg-black/10 px-3 py-1.5 rounded-lg border border-white/5 shadow-md transition-opacity duration-300 ${!isMasked ? 'opacity-[0.15]' : ''}`}>
              Tu declaración. Tu firma. Tu evidencia.
            </p>
          </div>
          <div className="max-w-md">
            <p className={`inline-block text-sm text-text-muted leading-relaxed backdrop-blur-md bg-black/40 px-3 py-2 rounded-lg border border-white/5 shadow-md transition-opacity duration-300 ${!isMasked ? 'opacity-40' : ''}`}>
              Un registro público donde periodistas, abogados, científicos
              y activistas en Latinoamérica pueden dejar una declaración
              firmada criptográficamente. Si algo les pasa, sus propias
              palabras quedan como evidencia pública, fechada e inmutable.
            </p>
          </div>
        </div>

        {/* Buttons Section */}
        <div className={`backdrop-blur-[3px] bg-black/40 p-3 rounded-2xl border border-white/5 shadow-xl flex flex-wrap items-center gap-3 w-fit ${isMasked ? 'invisible pointer-events-none' : ''}`}>
          <Link
            href="/register"
            className="inline-flex items-center rounded border border-accent bg-accent/10 text-accent px-5 py-2.5 text-sm hover:bg-accent/20 transition-colors"
          >
            Crear cuenta →
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded border border-border-strong text-text px-5 py-2.5 text-sm hover:border-accent hover:text-accent transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/declarations"
            className="inline-flex items-center rounded border border-border-strong text-text-muted hover:text-text px-5 py-2.5 text-sm transition-colors"
          >
            Ver declaraciones públicas
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <main className="flex-1 flex flex-col">
        <section className="relative h-screen min-h-[600px] shrink-0 w-full flex items-center px-6 py-16 overflow-hidden">
          <HeroBackground />
          
          <div className="absolute inset-0 z-10 flex items-center pointer-events-auto">
            <HeroContent isMasked={false} />
          </div>

          <div 
            className="absolute inset-0 pointer-events-none z-20 flex items-center"
            aria-hidden="true"
            style={{
              maskImage: 'conic-gradient(from var(--beam-mask-start, 0deg) at var(--beam-x, 50%) var(--beam-y, 50%), transparent 0deg, rgba(0,0,0,0.8) 12deg, black 24deg, rgba(0,0,0,0.8) 36deg, transparent 48deg, transparent 360deg)',
              WebkitMaskImage: 'conic-gradient(from var(--beam-mask-start, 0deg) at var(--beam-x, 50%) var(--beam-y, 50%), transparent 0deg, rgba(0,0,0,0.8) 12deg, black 24deg, rgba(0,0,0,0.8) 36deg, transparent 48deg, transparent 360deg)'
            }}
          >
            <HeroContent isMasked={true} />
          </div>
        </section>

        {/* Mission & Etymology Section */}
        <section className="border-t border-border bg-black/20 relative z-10">
          <div className="mx-auto max-w-5xl px-6 py-24 grid md:grid-cols-2 gap-16 md:gap-8 items-center">
            
            {/* Left: Mission */}
            <div className="space-y-6 max-w-lg">
              <h2 className="text-3xl font-mono tracking-tight text-white mb-8">Nuestra Misión</h2>
              <p className="text-text-muted leading-relaxed text-lg">
                Consta nace para respaldar a periodistas, activistas y ciudadanos en toda Latinoamérica.
                En regiones donde la verdad es frecuentemente desafiada, proveemos un registro público
                inmutable y criptográficamente seguro.
              </p>
              <p className="text-text-muted leading-relaxed text-lg">
                Tus palabras, aseguradas por tecnología blockchain e IPFS, se mantienen como
                evidencia irrefutable que no puede ser alterada, silenciada ni borrada.
              </p>

              {/* Open Source Badge */}
              <div className="pt-6 mt-8 border-t border-white/5 flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.008.069-.008 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">100% Open Source</h4>
                  <p className="text-xs text-text-muted mt-0.5">Auditable por cualquier persona. Sin cajas negras.</p>
                </div>
                <Link href="https://github.com/" target="_blank" className="ml-auto text-xs text-text-muted hover:text-white transition-colors flex items-center gap-1 group">
                  Ver código
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: Etymology Breakdown */}
            <div className="flex justify-center md:justify-end">
              <div className="relative w-fit">
                <h3 
                  className="inline-block text-5xl tracking-tight text-white mb-2"
                  style={{ fontFamily: '"DejaVu Serif Condensed", "DejaVu Serif", serif', fontWeight: 700 }}
                >
                  consta
                </h3>
                
                {/* Etymology Breakdown Section */}
                <div className="mt-4 space-y-6">
                  {/* Bracket Indicators */}
                  <div className="flex gap-1 h-2 -mt-4 w-fit px-2">
                    <div className="w-12 border-l border-r border-b border-white/20 rounded-b-sm"></div>
                    <div className="w-14 border-l border-r border-b border-white/20 rounded-b-sm"></div>
                  </div>

                  <div className="relative">
                    {/* Connector Lines (SVG) */}
                    <svg className="absolute inset-0 w-full h-full -z-10 pointer-events-none overflow-visible" opacity="0.25">
                      <path d="M 32,-10 L 56,15 M 88,-10 L 180,15 M 56,90 L 118,115 M 180,90 L 118,115" stroke="white" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                    </svg>

                    {/* Breakdown Cards */}
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 w-28">
                          <div className="font-mono text-sm font-bold text-white mb-1">con-</div>
                          <div className="text-[9px] text-text-dim uppercase tracking-wider mb-1">Latín</div>
                          <div className="text-[11px] text-text-muted leading-tight">junto a, con</div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 w-28">
                          <div className="font-mono text-sm font-bold text-white mb-1">stare</div>
                          <div className="text-[9px] text-text-dim uppercase tracking-wider mb-1">Latín</div>
                          <div className="text-[11px] text-text-muted leading-tight">estar de pie</div>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 rounded-xl border border-white/10 w-[236px]">
                        <div className="font-mono text-sm font-bold text-white mb-1">consta</div>
                        <div className="text-xs text-text-muted leading-relaxed italic">
                          mantenerse firme, ser evidente o tener certeza
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-6 py-16 grid gap-10 sm:grid-cols-3 font-mono text-sm">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-text-dim">
                01 Escribes
              </p>
              <p className="text-text-muted leading-relaxed">
                Una declaración con tu contexto, tu trabajo y tu estado
                mental al momento de firmar.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-text-dim">
                02 Se firma
              </p>
              <p className="text-text-muted leading-relaxed">
                Tu navegador genera una clave Ed25519, hashea el texto con
                SHA-256 y firma el hash. El texto sube a IPFS.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-text-dim">
                03 Queda público
              </p>
              <p className="text-text-muted leading-relaxed">
                Con timestamp RFC 3161 y registro en blockchain. Cualquiera
                puede recalcular el hash y verificar que nada se alteró.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
