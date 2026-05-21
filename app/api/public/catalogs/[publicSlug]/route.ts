import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '../../../../lib/security/password-hash';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { prisma } from '../../../../lib/server/prisma';

type PublicCatalogRouteContext = {
  params: Promise<{
    publicSlug: string;
  }>;
};

const protectedAccessBodySchema = z.object({
  password: z.string().min(1).max(128),
});

function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    return decodeURIComponent(part.slice(separatorIndex + 1));
  }

  return null;
}

function publicationAccessCookieName(publicationId: string) {
  return `cmk_pub_${publicationId}`;
}

async function resolvePublishedCatalogBySlug(publicSlug: string) {
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

function mapPublicCatalogPayload(publication: NonNullable<Awaited<ReturnType<typeof resolvePublishedCatalogBySlug>>>) {
  return {
    catalog: {
      id: publication.catalog.id,
      title: publication.catalog.title,
      description: publication.catalog.description,
      coverImageUrl: publication.catalog.coverImageUrl,
      updatedAt: publication.catalog.updatedAt,
      items: publication.catalog.items,
    },
    publication: {
      publicSlug: publication.publicSlug,
      visibility: publication.visibility,
      seoTitle: publication.seoTitle,
      seoDescription: publication.seoDescription,
      socialImageUrl: publication.socialImageUrl,
      publishedAt: publication.publishedAt,
    },
  };
}

export async function GET(request: Request, context: PublicCatalogRouteContext) {
  const { publicSlug } = await context.params;
  const limiter = checkRateLimit('public-catalogs:get', { limit: 200, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const publication = await resolvePublishedCatalogBySlug(publicSlug);
  if (!publication || publication.status !== 'PUBLISHED' || publication.catalog.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'PUBLICATION_NOT_FOUND' }, { status: 404 });
  }

  if (publication.visibility === 'PROTECTED') {
    if (!publication.passwordHash) {
      return NextResponse.json({ error: 'PUBLICATION_FORBIDDEN' }, { status: 403 });
    }

    const accessCookieName = publicationAccessCookieName(publication.id);
    const accessCookie = getCookieValue(request.headers.get('cookie'), accessCookieName);
    if (accessCookie !== publication.passwordHash) {
      return NextResponse.json({ error: 'PUBLICATION_PASSWORD_REQUIRED' }, { status: 401 });
    }
  }

  const response = NextResponse.json({ data: mapPublicCatalogPayload(publication) });
  if (publication.visibility === 'UNLISTED' || publication.visibility === 'PROTECTED') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

export async function POST(request: Request, context: PublicCatalogRouteContext) {
  const { publicSlug } = await context.params;
  const limiter = checkRateLimit('public-catalogs:unlock:post', { limit: 30, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = protectedAccessBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  const publication = await resolvePublishedCatalogBySlug(publicSlug);
  if (!publication || publication.status !== 'PUBLISHED' || publication.catalog.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'PUBLICATION_NOT_FOUND' }, { status: 404 });
  }

  if (publication.visibility !== 'PROTECTED') {
    return NextResponse.json({ error: 'PUBLICATION_NOT_PROTECTED' }, { status: 400 });
  }

  if (!publication.passwordHash) {
    return NextResponse.json({ error: 'PUBLICATION_FORBIDDEN' }, { status: 403 });
  }

  const isValid = verifyPassword(parsed.data.password, publication.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: 'PUBLICATION_INVALID_PASSWORD' }, { status: 401 });
  }

  const response = NextResponse.json({ data: { unlocked: true } });
  response.cookies.set(publicationAccessCookieName(publication.id), publication.passwordHash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: `/c/${publication.publicSlug}`,
    maxAge: 60 * 60 * 12,
  });
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}
