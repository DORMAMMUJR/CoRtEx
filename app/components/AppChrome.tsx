'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

type AppChromeProps = {
  children: ReactNode;
};

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.17),_transparent_40%),linear-gradient(to_bottom,_#09090b,_#18181b)] text-zinc-100 xl:flex">
      <Sidebar currentPath={pathname} />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
