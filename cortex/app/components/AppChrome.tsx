'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

type AppChromeProps = {
  children: ReactNode;
};

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const appShellRoutes = ['/dashboard', '/catalogs', '/bookshelves', '/settings'];
  const isAppShellRoute = appShellRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isAppShellRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_rgba(9,9,11,0)_42%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.10),_rgba(9,9,11,0)_38%),linear-gradient(to_bottom,_#06070b,_#0f1117_55%,_#0a0a0f)] text-zinc-100 xl:flex">
      <Sidebar currentPath={pathname} />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
