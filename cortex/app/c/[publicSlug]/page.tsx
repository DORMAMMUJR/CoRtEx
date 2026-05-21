import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ExternalLink, Image as ImageIcon, ShoppingBag, TextCursorInput } from 'lucide-react';
import ProtectedCatalogUnlock from './ProtectedCatalogUnlock';
import { prisma } from '../../lib/server/prisma';

type PublicCatalogPageProps = {
  params: Promise<{
    publicSlug: string;
  }>;
};

function publicationAccessCookieName(publicationId: string) {
  return `cmk_pub_${publicationId}`;
}

async function resolvePublishedCatalog(publicSlug: string) {
  return prisma.publication.findUnique({
    where: { publicSlug },
    include: {
      catalog: {
        include: {
          items: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });
}

export async function generateMetadata(props: PublicCatalogPageProps): Promise<Metadata> {
  const { publicSlug } = await props.params;
  const publication = await prisma.publication.findUnique({
    where: { publicSlug },
    select: {
      visibility: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      socialImageUrl: true,
      catalog: {
        select: {
          status: true,
          title: true,
          description: true,
        },
      },
    },
  });

  if (!publication || publication.status !== 'PUBLISHED' || publication.catalog.status !== 'PUBLISHED') {
    return {
      title: 'Catalogo no disponible',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = publication.seoTitle?.trim() || publication.catalog.title;
  const description = publication.seoDescription?.trim() || publication.catalog.description?.trim() || 'Catalogo publicado en CoRtEx';
  const isPublic = publication.visibility === 'PUBLIC';

  return {
    title,
    description,
    robots: {
      index: isPublic,
      follow: isPublic,
      nocache: !isPublic,
    },
    openGraph: {
      title,
      description,
      images: publication.socialImageUrl ? [{ url: publication.socialImageUrl }] : undefined,
    },
  };
}

function formatPrice(value: unknown, currency: string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(parsed);
    }
  }

  return null;
}

export default async function PublicCatalogPage(props: PublicCatalogPageProps) {
  const { publicSlug } = await props.params;
  const publication = await resolvePublishedCatalog(publicSlug);
  if (!publication || publication.status !== 'PUBLISHED' || publication.catalog.status !== 'PUBLISHED') {
    notFound();
  }

  if (publication.visibility === 'PROTECTED') {
    if (!publication.passwordHash) {
      notFound();
    }

    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(publicationAccessCookieName(publication.id))?.value;
    if (accessCookie !== publication.passwordHash) {
      return <ProtectedCatalogUnlock publicSlug={publicSlug} />;
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(217,70,239,0.16),transparent_34%),linear-gradient(160deg,#080808,#101018_44%,#070708)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-10">
      <section className="mx-auto w-full max-w-5xl space-y-5">
        <header className="panel-glass rounded-3xl border border-white/15 bg-white/[0.05] p-5 sm:p-7">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-400">Catalogo publicado</p>
          <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">{publication.catalog.title}</h1>
          {publication.catalog.description ? <p className="mt-3 max-w-3xl text-sm text-zinc-300 sm:text-base">{publication.catalog.description}</p> : null}
        </header>

        <section className="space-y-4">
          {publication.catalog.items.map((item) => {
            if (item.type === 'TEXT') {
              return (
                <article key={item.id} className="panel-glass rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2 text-zinc-400">
                    <TextCursorInput className="h-4 w-4 text-cyan-200" />
                    <span className="text-xs uppercase tracking-[0.14em]">Texto</span>
                  </div>
                  {item.name ? <h2 className="text-lg font-medium text-zinc-100">{item.name}</h2> : null}
                  {item.description ? <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.description}</p> : null}
                </article>
              );
            }

            if (item.type === 'IMAGE') {
              return (
                <article key={item.id} className="panel-glass overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-zinc-400">
                    <ImageIcon className="h-4 w-4 text-cyan-200" />
                    <span className="text-xs uppercase tracking-[0.14em]">Imagen</span>
                  </div>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name ?? 'Imagen del catalogo'} className="h-auto w-full object-cover" />
                  ) : (
                    <div className="grid h-48 place-items-center bg-black/30 text-sm text-zinc-500">Sin imagen</div>
                  )}
                  {item.description ? <p className="px-4 py-3 text-sm text-zinc-300">{item.description}</p> : null}
                </article>
              );
            }

            if (item.type === 'PRODUCT') {
              const priceLabel = formatPrice(item.price, item.currency || 'MXN');
              return (
                <article key={item.id} className="panel-glass rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2 text-zinc-400">
                    <ShoppingBag className="h-4 w-4 text-cyan-200" />
                    <span className="text-xs uppercase tracking-[0.14em]">Producto</span>
                  </div>
                  <h2 className="text-lg font-medium text-zinc-100">{item.name || 'Producto'}</h2>
                  {item.description ? <p className="mt-2 text-sm text-zinc-300">{item.description}</p> : null}
                  {priceLabel ? <p className="mt-3 text-base font-semibold text-emerald-200">{priceLabel}</p> : null}
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name ?? 'Producto'} className="mt-3 h-44 w-full rounded-xl border border-white/10 object-cover" />
                  ) : null}
                </article>
              );
            }

            const ctaUrl =
              typeof item.metadata === 'object' &&
              item.metadata !== null &&
              'url' in item.metadata &&
              typeof (item.metadata as { url?: unknown }).url === 'string'
                ? (item.metadata as { url: string }).url
                : '#';

            const ctaLabel =
              typeof item.metadata === 'object' &&
              item.metadata !== null &&
              'label' in item.metadata &&
              typeof (item.metadata as { label?: unknown }).label === 'string'
                ? (item.metadata as { label: string }).label
                : item.name || 'Abrir enlace';

            return (
              <article key={item.id} className="panel-glass rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2 text-zinc-400">
                  <ExternalLink className="h-4 w-4 text-cyan-200" />
                  <span className="text-xs uppercase tracking-[0.14em]">CTA</span>
                </div>
                {item.description ? <p className="mb-3 text-sm text-zinc-300">{item.description}</p> : null}
                <a
                  href={ctaUrl}
                  target={ctaUrl.startsWith('http') ? '_blank' : undefined}
                  rel={ctaUrl.startsWith('http') ? 'noreferrer' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25"
                >
                  {ctaLabel}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
