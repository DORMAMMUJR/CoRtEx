'use client';

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Image,
  Layers3,
  Loader2,
  Globe,
  PencilRuler,
  Plus,
  Save,
  SlidersHorizontal,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CatalogItemInput } from '../../lib/contracts/catalog';

type CatalogItemType = CatalogItemInput['type'];

type CatalogEditorMetadata = Record<string, unknown>;
type CatalogEditorItem = {
  id?: string;
  type: CatalogItemType;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  metadata?: CatalogEditorMetadata;
  position: number;
};

type CatalogEditorRecord = {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

    const type: CatalogItemType =
      record.type === 'TEXT' || record.type === 'IMAGE' || record.type === 'PRODUCT' || record.type === 'CTA'
        ? record.type
        : 'TEXT';

    const metadata =
      typeof record.metadata === 'object' && record.metadata !== null ? (record.metadata as CatalogEditorMetadata) : undefined;

    return {
      id: typeof record.id === 'string' ? record.id : undefined,
      type,
      name: typeof record.name === 'string' && record.name.length ? record.name : `Elemento ${index + 1}`,
      description: typeof record.description === 'string' ? record.description : undefined,
      price: typeof record.price === 'number' ? record.price : undefined,
      currency: typeof record.currency === 'string' ? record.currency : 'MXN',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : undefined,
      metadata,
      position: typeof record.position === 'number' ? record.position : index,
    };
  });
}

function normalizeCatalogRecord(rawCatalog: unknown, fallbackId: string): CatalogEditorRecord | null {
  if (typeof rawCatalog !== 'object' || rawCatalog === null) {
    return null;
  }

  const record = rawCatalog as Record<string, unknown>;
  const status: CatalogEditorRecord['status'] =
    record.status === 'PUBLISHED' || record.status === 'ARCHIVED' ? record.status : 'DRAFT';

  return {
    id: typeof record.id === 'string' ? record.id : fallbackId,
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    status,
  };
}

export default function CatalogVisualEditorPage(props: CatalogVisualEditorPageProps) {
  const { catalogId } = React.use(props.params);
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogEditorRecord | null>(null);
  const [items, setItems] = useState<CatalogEditorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdatingCatalog, setIsUpdatingCatalog] = useState(false);
  const [isDeletingCatalog, setIsDeletingCatalog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
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
    setIsDirty(true);
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

  const updateSelectedItem = useCallback(<K extends keyof CatalogEditorItem,>(field: K, value: CatalogEditorItem[K]) => {
    let didChange = false;
    setItems((current) => {
      if (selectedIndex === null || !current[selectedIndex]) {
        return current;
      }

      if (current[selectedIndex][field] === value) {
        return current;
      }

      const next = [...current];
      next[selectedIndex] = {
        ...next[selectedIndex],
        [field]: value,
      } as CatalogEditorItem;
      didChange = true;

      return next;
    });
    if (didChange) {
      setIsDirty(true);
    }
  }, [selectedIndex]);

  const handleDeleteItem = useCallback(() => {
    if (!window.confirm('Seguro que deseas eliminar este elemento?')) return;

    let didChange = false;
    setError(null);
    setSaveMessage('');
    setItems((current) => {
      if (selectedIndex === null || !current[selectedIndex]) {
        return current;
      }

      didChange = true;
      return current
        .filter((_, index) => index !== selectedIndex)
        .map((item, index) => ({
          ...item,
          position: index,
        }));
    });
    if (didChange) {
      setIsDirty(true);
      setSelectedIndex(null);
    }
  }, [selectedIndex]);

  const handleMoveUp = useCallback(() => {
    let didChange = false;
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

      didChange = true;
      setSelectedIndex(targetIndex);
      return normalized;
    });
    if (didChange) {
      setIsDirty(true);
    }
  }, [selectedIndex]);

  const handleMoveDown = useCallback(() => {
    let didChange = false;
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

      didChange = true;
      setSelectedIndex(targetIndex);
      return normalized;
    });
    if (didChange) {
      setIsDirty(true);
    }
  }, [selectedIndex]);

  const getItemIcon = useCallback((type: CatalogItemType) => {
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
        const response = await fetch(`/api/catalogs/${catalogId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as
          | { data?: { items?: unknown } & Record<string, unknown>; error?: string }
          | null;

        if (!response.ok) {
          if (isMounted) {
            setError(readApiError(payload, 'No se pudo cargar el catalogo.'));
            setCatalog(null);
            setItems([]);
          }
          return;
        }

        const nextCatalog = normalizeCatalogRecord(payload?.data, catalogId);
        if (!nextCatalog) {
          if (isMounted) {
            setError('No se pudo cargar el catalogo.');
            setCatalog(null);
            setItems([]);
          }
          return;
        }

        if (!isMounted) {
          return;
        }

        setItems(normalizeItems(payload?.data?.items));
        setCatalog(nextCatalog);
        setIsDirty(false);
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
      setIsDirty(false);
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

      const nextCatalog = normalizeCatalogRecord(payload?.data, catalogId);
      if (nextCatalog) {
        setCatalog(nextCatalog);
      }
      setIsDirty(false);
      setSaveMessage('Catalogo actualizado');
      window.setTimeout(() => setSaveMessage(''), 2200);
    } catch {
      setError('No se pudo actualizar el catalogo.');
    } finally {
      setIsUpdatingCatalog(false);
    }
  }, [catalog, catalogId]);

  const handlePublishCatalog = useCallback(async () => {
    if (!catalog || catalog.status === 'PUBLISHED') {
      return;
    }

    setIsPublishing(true);
    setError(null);
    setSaveMessage('');

    try {
      const response = await fetch(`/api/catalogs/${catalogId}/publish`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string }
        | null;

      if (!response.ok) {
        setError(readApiError(payload, 'No se pudo publicar el catalogo.'));
        return;
      }

      setCatalog((current) => (current ? { ...current, status: 'PUBLISHED' } : current));
      setSaveMessage('Catalogo publicado');
      window.setTimeout(() => setSaveMessage(''), 2200);
    } catch {
      setError('No se pudo publicar el catalogo.');
    } finally {
      setIsPublishing(false);
    }
  }, [catalog, catalogId]);

  const handleDeleteCatalog = useCallback(async () => {
    if (!window.confirm('Esta accion eliminara el catalogo de forma permanente. Deseas continuar?')) return;

    setIsDeletingCatalog(true);
    setError(null);
    setSaveMessage('');

    try {
      const response = await fetch(`/api/catalogs/${catalogId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string }
        | null;

      if (!response.ok) {
        setError(readApiError(payload, 'No se pudo eliminar el catalogo.'));
        return;
      }

      setIsDirty(false);
      router.push('/catalogs');
    } catch {
      setError('No se pudo eliminar el catalogo.');
    } finally {
      setIsDeletingCatalog(false);
    }
  }, [catalogId, router]);

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
          {isDirty ? <span className="text-xs text-amber-200/90">Cambios sin guardar</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePublishCatalog}
            disabled={catalog?.status === 'PUBLISHED' || isPublishing || isLoading}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              catalog?.status === 'PUBLISHED'
                ? 'border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200/60'
                : 'border-fuchsia-300/45 bg-fuchsia-300/15 text-fuchsia-100 hover:bg-fuchsia-300/25'
            }`}
          >
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {catalog?.status === 'PUBLISHED' ? 'Publicado' : 'Publicar'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </header>

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
          <div
            className="flex-1 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-4"
            onClick={() => setSelectedIndex(null)}
          >
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
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedIndex(index);
                      }}
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
                      onChange={(event) => updateSelectedItem('type', event.target.value as CatalogItemType)}
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
                      onChange={(event) => {
                        setIsDirty(true);
                        setCatalog((current) => (current ? { ...current, title: event.target.value } : current));
                      }}
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
                      onChange={(event) => {
                        setIsDirty(true);
                        setCatalog((current) => (current ? { ...current, description: event.target.value } : current));
                      }}
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
                  <button
                    type="button"
                    onClick={handleDeleteCatalog}
                    disabled={isDeletingCatalog}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingCatalog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Eliminar Catalogo
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

      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {saveMessage ? (
          <article className="panel-glass rounded-xl border border-emerald-300/30 p-3 shadow-lg shadow-black/25">
            <p className="text-sm text-emerald-200">{saveMessage}</p>
          </article>
        ) : null}
        {error ? (
          <article className="panel-glass rounded-xl border border-rose-300/30 p-3 shadow-lg shadow-black/25">
            <p className="flex items-center gap-2 text-sm text-rose-200">
              <CircleAlert className="h-4 w-4" />
              {error}
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
