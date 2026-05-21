'use client';

import { ArrowLeft, CircleAlert, Layers3, Loader2, PencilRuler, Plus, Save, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type CatalogEditorItem = {
  id?: string;
  type: string;
  name: string;
  position: number;
  [key: string]: any;
};

type CatalogVisualEditorPageProps = {
  params: Promise<{
    catalogId: string;
  }>;
};

function readApiError(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.length) {
      return error;
    }
  }

  return fallback;
}

function normalizeItems(rawItems: unknown): CatalogEditorItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map((item, index) => {
    const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};

    return {
      ...record,
      id: typeof record.id === 'string' ? record.id : undefined,
      type: typeof record.type === 'string' ? record.type : 'TEXT',
      name: typeof record.name === 'string' && record.name.length ? record.name : `Elemento ${index + 1}`,
      position: typeof record.position === 'number' ? record.position : index,
    };
  });
}

export default function CatalogVisualEditorPage(props: CatalogVisualEditorPageProps) {
  const { catalogId } = React.use(props.params);
  const [items, setItems] = useState<CatalogEditorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const selectedItem = useMemo(() => items[0] ?? null, [items]);

  const handleAddItem = useCallback(() => {
    setError(null);
    setSaveMessage('');
    setItems((current) => [
      ...current,
      {
        type: 'TEXT',
        name: `Bloque ${current.length + 1}`,
        position: current.length,
      },
    ]);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalogItems() {
      setIsLoading(true);
      setError(null);

      try {
        const directResponse = await fetch(`/api/catalogs/${catalogId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        const directPayload = (await directResponse.json().catch(() => null)) as
          | { data?: { items?: unknown }; error?: string }
          | null;

        if (directResponse.ok && directPayload?.data) {
          if (!isMounted) {
            return;
          }

          setItems(normalizeItems(directPayload.data.items));
          return;
        }

        const listResponse = await fetch('/api/catalogs', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        const listPayload = (await listResponse.json().catch(() => null)) as
          | { data?: Array<{ id?: string; items?: unknown }>; error?: string }
          | null;

        if (!listResponse.ok) {
          if (!isMounted) {
            return;
          }

          setError(readApiError(listPayload, 'No se pudo cargar el catalogo.'));
          return;
        }

        const catalog = Array.isArray(listPayload?.data)
          ? listPayload.data.find((entry) => entry?.id === catalogId)
          : null;

        if (!isMounted) {
          return;
        }

        setItems(normalizeItems(catalog?.items));
      } catch {
        if (!isMounted) {
          return;
        }

        setError('No se pudo cargar el catalogo.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalogItems();

    return () => {
      isMounted = false;
    };
  }, [catalogId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage('');

    try {
      const response = await fetch(`/api/catalogs/${catalogId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(items),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string }
        | null;

      if (!response.ok) {
        setError(readApiError(payload, 'No se pudieron guardar los cambios.'));
        return;
      }

      setItems(normalizeItems(payload?.data));
      setSaveMessage('Cambios guardados');
      window.setTimeout(() => setSaveMessage(''), 2200);
    } catch {
      setError('No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  }, [catalogId, items]);

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
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </header>

      {error ? (
        <article className="panel-glass rounded-2xl border-rose-300/30 p-3">
          <p className="flex items-center gap-2 text-sm text-rose-200">
            <CircleAlert className="h-4 w-4" />
            {error}
          </p>
        </article>
      ) : null}

      {saveMessage ? (
        <article className="panel-glass rounded-2xl border-emerald-300/30 p-3">
          <p className="text-sm text-emerald-200">{saveMessage}</p>
        </article>
      ) : null}

      <div className="flex min-h-[calc(100vh-180px)] gap-4">
        <aside className="panel-glass w-64 shrink-0 rounded-2xl p-4">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <PencilRuler className="h-4 w-4 text-amber-200" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Herramientas</h2>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
          >
            <Plus className="h-4 w-4" />
            Agregar item
          </button>
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
            {isLoading ? (
              <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-black/20 text-sm text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
                {JSON.stringify(items, null, 2)}
              </pre>
            )}
          </div>
        </main>

        <aside className="panel-glass w-72 shrink-0 rounded-2xl p-4">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <SlidersHorizontal className="h-4 w-4 text-fuchsia-200" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Propiedades</h2>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
              {selectedItem ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Elemento activo</p>
                  <p className="font-medium text-zinc-100">{selectedItem.name || 'Sin nombre'}</p>
                  <p className="text-xs text-zinc-300">Tipo: {selectedItem.type}</p>
                  <p className="text-xs text-zinc-400">Posicion: {selectedItem.position + 1}</p>
                </div>
              ) : (
                'Configuracion del elemento'
              )}
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
