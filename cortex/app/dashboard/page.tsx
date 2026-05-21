import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthError, requireAuthenticatedPageUserId } from '../lib/server/auth';

async function requireDashboardSession() {
  try {
    await requireAuthenticatedPageUserId();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/');
    }
    redirect('/');
  }
}

const dashboardSections = [
  {
    title: 'Catalogos',
    subtitle: 'Gestiona la estructura, contenido y estado de publicacion de cada catalogo.',
    href: '/catalogs',
  },
  {
    title: 'Estanterias',
    subtitle: 'Organiza colecciones por contexto comercial, linea o segmento.',
    href: '/bookshelves',
  },
  {
    title: 'Configuracion',
    subtitle: 'Controla preferencias de cuenta, seguridad y parametros del espacio de trabajo.',
    href: '/settings',
  },
];

export default async function DashboardPage() {
  await requireDashboardSession();

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/15 bg-white/[0.05] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Panel principal</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100 sm:text-3xl">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          Selecciona una seccion para continuar tu flujo de trabajo.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-xl transition hover:border-amber-300/45 hover:bg-amber-300/10"
          >
            <h2 className="text-lg font-semibold text-zinc-100 group-hover:text-amber-100">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{section.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
