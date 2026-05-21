'use client';

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Image,
  Layers3,
  Loader2,
  PencilRuler,
  Plus,
  Save,
  SlidersHorizontal,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
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
  const [catalog, setCatalog] = useState<any>(null);
  const [items, setItems] = useState<CatalogEditorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingCatalog, setIsUpdatingCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedItem = useMemo(() => {
    if (selectedIndex === null) {
      return null;
    }

    return items[selectedIndex] ?? null;
  }, [items, selectedIndex]);

  const handleAddItem = useCallback(() => {
    setError(null);
    setSaveMessage('');
    setItems((current) => {
      const nextIndex = current.length;
      setSelectedIndex(nextIndex);

      return [
        ...current,
        {
        type: 'TEXT',
        name: `Bloque ${current.length + 1}`,
        position: current.length,
        },
      ];
    });
  }, []);

  const updateSelectedItem = useCallback((field: string, value: any) => {
    setItems((current) => {
      if (selectedIndex === null || !current[selectedIndex]) {
        return current;
      }

      const next = [...current];
      next[selectedIndex] = {
        ...next[selectedIndex],
        [field]: value,
      };

      return next;
    });
  }, [selectedIndex]);

  const handleDeleteItem = useCallback(() => {
    setError(null);
    setSaveMessage('');
    setItems((current) => {
      if (selectedIndex === null || !current[selectedIndex]) {
        return current;
      }

      return current
        .filter((_, index) => index !== selectedIndex)
        .map((item, index) => ({
          ...item,
          position: index,
        }));
    });
    setSelectedIndex(null);
  }, [selectedIndex]);

  const handleMoveUp = useCallback(() => {
    setError(null);
    setSaveMessage('');
    setItems((current) => {
      if (selectedIndex === null || selectedIndex <= 0 || !current[selectedIndex]) {
        return current;
      }

      const targetIndex = selectedIndex - 1;
      const next = [...current];
      [next[targetIndex], next[selectedIndex]] = [next[selectedIndex], next[targetIndex]];

      const normalized = next.map((item, index) => ({
        ...item,
        position: index,
      }));

      setSelectedIndex(targetIndex);
      return normalized;
    });
  }, [selectedIndex]);

  const handleMoveDown = useCallback(() => {
    setError(null);
    setSaveMessage('');
    setItems((current) => {
      if (selectedIndex === null || selectedIndex >= current.length - 1 || !current[selectedIndex]) {
        return current;
      }

      const targetIndex = selectedIndex + 1;
      const next = [...current];
      [next[targetIndex], next[selectedIndex]] = [next[selectedIndex], next[targetIndex]];

      const normalized = next.map((item, index) => ({
        ...item,
        position: index,
      }));

      setSelectedIndex(targetIndex);
      return normalized;
    });
  }, [selectedIndex]);

  const getItemIcon = useCallback((type: string) => {
    if (type === 'TEXT') {
      return Type;
    }

    if (type === 'IMAGE') {
      return Image;
    }

    if (type === 'PRODUCT') {
      return Tag;
    }

    return Layers3;
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
          | { data?: { id?: string; title?: string; description?: string; status?: string; items?: unknown }; error?: string }
          | null;

        if (directResponse.ok && directPayload?.data) {
          if (!isMounted) {
            return;
          }

          setItems(normalizeItems(directPayload.data.items));
          setCatalog({
            id: directPayload.data.id ?? catalogId,
            title: directPayload.data.title ?? '',
            description: directPayload.data.description ?? '',
            status: directPayload.data.status ?? 'DRAFT',
          });
          setSelectedIndex(null);
          return;
        }

        const listResponse = await fetch('/api/catalogs', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        const listPayload = (await listResponse.json().catch(() => null)) as
          | { data?: Array<{ id?: string; title?: string; description?: string; status?: string; items?: unknown }>; error?: string }
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
        setCatalog(
          catalog
            ? {
                id: catalog.id ?? catalogId,
                title: catalog.title ?? '',
                description: catalog.description ?? '',
                status: catalog.status ?? 'DRAFT',
              }
            : null,
        );
        setSelectedIndex(null);
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

  const handleUpdateCatalog = useCallback(async () => {
    if (!catalog) {
      return;
    }

    setIsUpdatingCatalog(true);
    setError(null);
    setSaveMessage('');

    try {
      const response = await fetch(`/api/catalogs/${catalogId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: catalog.title ?? '',
          description: catalog.description ?? '',
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { id?: string; title?: string; description?: string; status?: string };
            error?: string;
          }
        | null;

      if (!response.ok) {
        setError(readApiError(payload, 'No se pudo actualizar el catalogo.'));
        return;
      }

      setCatalog((current: any) => ({
        ...current,
        ...(payload?.data ?? {}),
      }));
      setSaveMessage('Catalogo actualizado');
      window.setTimeout(() => setSaveMessage(''), 2200);
    } catch {
      setError('No se pudo actualizar el catalogo.');
    } finally {
      setIsUpdatingCatalog(false);
    }
  }, [catalog, catalogId]);

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
          <h1 className="text-lg font-semibold text-zinc-100 sm:text-xl">{catalog?.title || 'Cargando...'}</h1>
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
            ) : items.length === 0 ? (
              <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-black/20 text-sm text-zinc-400">
                No hay elementos todavia
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const ItemIcon = getItemIcon(item.type);
                  const isSelected = selectedIndex === index;

                  return (
                    <button
                      key={`${item.id ?? 'item'}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`panel-glass flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 border-cyan-300/40 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-cyan-100">
                        <ItemIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{item.name || 'Sin nombre'}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{item.type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Elemento activo</p>
                  <div className="space-y-1">
                    <label htmlFor="item-name" className="text-xs text-zinc-400">
                      Nombre
                    </label>
                    <input
                      id="item-name"
                      type="text"
                      value={selectedItem.name ?? ''}
                      onChange={(event) => updateSelectedItem('name', event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/55 focus:ring-1 focus:ring-cyan-300/50"
                      placeholder="Nombre del elemento"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="item-type" className="text-xs text-zinc-400">
                      Tipo
                    </label>
                    <select
                      id="item-type"
                      value={selectedItem.type ?? 'TEXT'}
                      onChange={(event) => updateSelectedItem('type', event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/55 focus:ring-1 focus:ring-cyan-300/50"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="PRODUCT">PRODUCT</option>
                      <option value="IMAGE">IMAGE</option>
                      <option value="CTA">CTA</option>
                    </select>
                  </div>
                  <p className="text-xs text-zinc-400">Posicion: {selectedItem.position + 1}</p>
                  <div className="space-y-2 pt-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Acciones</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleMoveUp}
                        disabled={selectedIndex === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={handleMoveDown}
                        disabled={selectedIndex === items.length - 1}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        Bajar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteItem}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : selectedIndex === null && catalog ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Catalogo</p>
                  <div className="space-y-1">
                    <label htmlFor="catalog-title" className="text-xs text-zinc-400">
                      Titulo
                    </label>
                    <input
                      id="catalog-title"
                      type="text"
                      value={catalog.title ?? ''}
                      onChange={(event) =>
                        setCatalog((current: any) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/55 focus:ring-1 focus:ring-cyan-300/50"
                      placeholder="Titulo del catalogo"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="catalog-description" className="text-xs text-zinc-400">
                      Descripcion
                    </label>
                    <textarea
                      id="catalog-description"
                      value={catalog.description ?? ''}
                      onChange={(event) =>
                        setCatalog((current: any) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/55 focus:ring-1 focus:ring-cyan-300/50"
                      placeholder="Descripcion del catalogo"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdateCatalog}
                    disabled={isUpdatingCatalog}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUpdatingCatalog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Actualizar Catalogo
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">Selecciona un elemento en el canvas</p>
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
