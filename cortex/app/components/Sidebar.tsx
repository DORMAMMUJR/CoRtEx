'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  X,
  Menu,
  LayoutDashboard,
  LibraryBig,
  BookOpen,
  Settings,
} from 'lucide-react';

type SidebarItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarProps = {
  appName?: string;
  currentPath?: string;
  items?: SidebarItem[];
};

const defaultItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Catalogos', href: '/catalogs', icon: BookOpen },
  { label: 'Estanterias', href: '/bookshelves', icon: LibraryBig },
  { label: 'Configuracion', href: '/settings', icon: Settings },
];

function SidebarContent({
  appName,
  currentPath,
  items,
  onNavigate,
}: {
  appName: string;
  currentPath: string;
  items: SidebarItem[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-300/80 via-yellow-500/70 to-orange-500/70" />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">SaaS</p>
          <h2 className="text-base font-semibold text-zinc-100">{appName}</h2>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
        CataMaker Workspace
      </div>
    </div>
  );
}

export default function Sidebar({
  appName = 'CataMaker',
  currentPath = '/',
  items = defaultItems,
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const selectedPath = useMemo(() => currentPath, [currentPath]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/70 px-4 backdrop-blur xl:hidden">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-300/80 via-yellow-500/70 to-orange-500/70" />
          <span className="text-sm font-semibold text-zinc-100">{appName}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-zinc-200 hover:bg-white/10"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden h-screen w-72 p-4 xl:sticky xl:top-0 xl:block">
        <SidebarContent appName={appName} currentPath={selectedPath} items={items} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] p-4">
            <div className="mb-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-200 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              appName={appName}
              currentPath={selectedPath}
              items={items}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
