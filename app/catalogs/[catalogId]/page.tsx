'use client';

import { ArrowLeft, Layers3, PencilRuler, Save, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

export default function CatalogVisualEditorPage() {
  return (
    <section className="min-h-screen space-y-5">
      <header className="panel-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Link
            href="/catalogs"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <h1 className="text-lg font-semibold text-zinc-100 sm:text-xl">Editor Visual del Catalogo</h1>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/25"
        >
          <Save className="h-4 w-4" />
          Guardar
        </button>
      </header>

      <div className="flex min-h-[calc(100vh-180px)] gap-4">
        <aside className="panel-glass w-64 shrink-0 rounded-2xl p-4">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <PencilRuler className="h-4 w-4 text-amber-200" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Herramientas</h2>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Bloques</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Media</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Acciones</div>
          </div>
        </aside>

        <main className="panel-glass flex min-h-full flex-1 flex-col rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <Layers3 className="h-4 w-4 text-cyan-200" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Canvas</h2>
          </div>
          <div className="flex-1 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-4">
            <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-black/20 text-sm text-zinc-400">
              Lienzo principal del catalogo
            </div>
          </div>
        </main>

        <aside className="panel-glass w-72 shrink-0 rounded-2xl p-4">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <SlidersHorizontal className="h-4 w-4 text-fuchsia-200" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Propiedades</h2>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
              Configuracion del elemento
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
              Estilos y comportamiento
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
              Metadatos
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
