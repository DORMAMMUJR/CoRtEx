import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppChrome from './components/AppChrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'CataMaker',
  description: 'Catalog builder SaaS',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
