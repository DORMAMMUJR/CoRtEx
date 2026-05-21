'use client';

import { BookOpen, CircleAlert, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type CatalogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

type CatalogRecord = {
  id: string;
  title: string;
  description: string | null;
  status: CatalogStatus;
  createdAt: string;
};

const statusTheme: Record<CatalogStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Borrador',
    className: 'border-amber-300/40 bg-amber-300/15 text-amber-100',
  },
  PUBLISHED: {
    label: 'Publicado',
    className: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
  },
  ARCHIVED: {
    label: 'Archivado',
    className: 'border-zinc-300/30 bg-zinc-200/10 text-zinc-200',
  },
};

function buildDefaultCatalogPayload() {
  const now = new Date();
  const slugId = Date.now().toString(36);
  return {
    title: `Catalogo ${now.toLocaleDateString('es-MX')}`,
    slug: `catalogo-${slugId}`,
    description: 'Catalogo base creado desde dashboard.',
    items: [],
  };
}

function readApiError(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.length) {
      return error;
    }
  }

  return fallback;
}

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/catalogs', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as { data?: CatalogRecord[]; error?: string } | null;
      if (!response.ok) {
        setCatalogs([]);
        setError(readApiError(payload, 'No se pudo cargar la lista de catalogos.'));
        return;
      }

      setCatalogs(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      setCatalogs([]);
      setError('No se pudo cargar la lista de catalogos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  const handleCreateCatalog = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/catalogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(buildDefaultCatalogPayload()),
      });

      const payload = (await response.json().catch(() => null)) as { data?: CatalogRecord; error?: string } | null;
      if (!response.ok) {
        setError(readApiError(payload, 'No se pudo crear el catalogo.'));
        return;
      }

      const createdCatalog = payload?.data;
      if (createdCatalog) {
        setCatalogs((current) => [createdCatalog, ...current]);
        return;
      }

      await loadCatalogs();
    } catch {
      setError('No se pudo crear el catalogo.');
    } finally {
      setIsCreating(false);
    }
  }, [loadCatalogs]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/15 bg-white/[0.05] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100 sm:text-3xl">Catalogos</h1>
            <p className="mt-2 text-sm text-zinc-300">Gestiona tus catalogos activos desde datos reales del backend.</p>
          </div>
          <button
            type="button"
            onClick={handleCreateCatalog}
            disabled={isCreating || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear nuevo catalogo
          </button>
        </div>
      </header>

      {error ? (
        <article className="panel-glass rounded-2xl border-rose-300/30 p-4">
          <p className="flex items-center gap-2 text-sm text-rose-200">
            <CircleAlert className="h-4 w-4" />
            {error}
          </p>
        </article>
      ) : null}

      {isLoading ? (
        <article className="panel-glass rounded-2xl p-6">
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando catalogos...
          </p>
        </article>
      ) : null}

      {!isLoading && catalogs.length === 0 ? (
        <article className="panel-glass rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 text-amber-200" />
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Aun no tienes catalogos</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Crea tu primer catalogo para empezar a cargar contenido y publicarlo.
              </p>
            </div>
          </div>
        </article>
      ) : null}

      {!isLoading && catalogs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogs.map((catalog) => (
            <Link key={catalog.id} href={`/catalogs/${catalog.id}`} className="group block outline-none">
              <article className="panel-glass h-full rounded-2xl p-5 transition duration-300 group-hover:border-cyan-300/40 group-hover:bg-white/10 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.1)] group-focus-visible:ring-2 group-focus-visible:ring-cyan-400/50">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="line-clamp-1 text-lg font-semibold text-zinc-100 group-hover:text-cyan-100 transition-colors">
                    {catalog.title}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.15em] ${statusTheme[catalog.status].className}`}
                  >
                    {statusTheme[catalog.status].label}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-300 group-hover:text-zinc-200 transition-colors">
                  {catalog.description?.trim().length
                    ? catalog.description
                    : 'Sin descripcion todavia. Agrega detalles para contextualizar este catalogo.'}
                </p>
              </article>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
