import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publishCatalogSchema } from '../../../../lib/contracts/catalog';
import { hashPassword } from '../../../../lib/security/password-hash';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { AuthError, requireAuthenticatedUserId } from '../../../../lib/server/auth';
import { prisma } from '../../../../lib/server/prisma';

type PublishRouteContext = {
  params: Promise<{
    catalogId: string;
  }>;
};

export async function POST(request: Request, context: PublishRouteContext) {
  const { catalogId } = await context.params;
  const limiter = checkRateLimit('catalogs:publish', { limit: 40, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json();
  const parsed = publishCatalogSchema.safeParse({
    ...body,
    catalogId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);
    const catalog = await prisma.catalog.findUnique({
      where: { id: parsed.data.catalogId },
      select: { id: true, userId: true },
    });

    if (!catalog) {
      return NextResponse.json({ error: 'CATALOG_NOT_FOUND' }, { status: 404 });
    }

    if (catalog.userId !== ownerId) {
      return NextResponse.json({ error: 'CATALOG_FORBIDDEN' }, { status: 403 });
    }

    const now = new Date();
    const passwordHash = parsed.data.password ? hashPassword(parsed.data.password) : null;

    const [data] = await prisma.$transaction([
      prisma.catalog.update({
        where: { id: catalog.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
        },
      }),
      prisma.publication.upsert({
        where: { catalogId: catalog.id },
        create: {
          catalogId: catalog.id,
          status: 'PUBLISHED',
          visibility: parsed.data.visibility,
          publicSlug: parsed.data.publicSlug,
          passwordHash,
          seoTitle: parsed.data.seoTitle,
          seoDescription: parsed.data.seoDescription,
          socialImageUrl: parsed.data.socialImageUrl,
          publishedAt: now,
        },
        update: {
          status: 'PUBLISHED',
          visibility: parsed.data.visibility,
          publicSlug: parsed.data.publicSlug,
          passwordHash,
          seoTitle: parsed.data.seoTitle,
          seoDescription: parsed.data.seoDescription,
          socialImageUrl: parsed.data.socialImageUrl,
          publishedAt: now,
        },
      }),
    ]);

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
        if (target.includes('publicSlug')) {
          return NextResponse.json({ error: 'PUBLICATION_SLUG_CONFLICT' }, { status: 409 });
        }
      }
    }

    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
