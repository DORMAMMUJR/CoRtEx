export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06070b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-5rem] h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute -right-28 top-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute bottom-[-6rem] left-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full rounded-3xl border border-white/15 bg-white/[0.06] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8 md:p-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs tracking-[0.2em] text-zinc-300">
            CORTEX
          </div>

          <div className="max-w-2xl space-y-5">
            <h1 className="text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl md:text-5xl">
              Plataforma inteligente para gestionar y escalar tus catalogos.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              Accede con tu cuenta para continuar en tu panel, organizar activos y activar tus flujos de publicacion.
            </p>
          </div>

          <div className="mt-10">
            <a
              href="/api/auth/oauth/google/authorize"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-zinc-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:w-auto sm:px-7 sm:py-3.5"
            >
              <span className="text-base transition group-hover:translate-x-0.5">G</span>
              Iniciar sesion con Google
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
