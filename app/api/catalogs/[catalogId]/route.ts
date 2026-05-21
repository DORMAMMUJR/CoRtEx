import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { updateCatalogSchema } from '../../../lib/contracts/catalog';
import { checkRateLimit } from '../../../lib/security/rate-limit';
import { AuthError, requireAuthenticatedUserId } from '../../../lib/server/auth';
import { prisma } from '../../../lib/server/prisma';

type CatalogRouteContext = {
  params: Promise<{
    catalogId: string;
  }>;
};

async function resolveOwnedCatalogOrError(catalogId: string, ownerId: string) {
  const catalog = await prisma.catalog.findUnique({
    where: { id: catalogId },
    select: { id: true, userId: true },
  });

  if (!catalog) {
    return { error: NextResponse.json({ error: 'CATALOG_NOT_FOUND' }, { status: 404 }) };
  }

  if (catalog.userId !== ownerId) {
    return { error: NextResponse.json({ error: 'CATALOG_FORBIDDEN' }, { status: 403 }) };
  }

  return { catalog };
}

export async function PATCH(request: Request, context: CatalogRouteContext) {
  const { catalogId } = await context.params;
  const limiter = checkRateLimit('catalogs:patch', { limit: 60, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json();
  const parsed = updateCatalogSchema.safeParse({
    ...body,
    catalogId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);

    const ownership = await resolveOwnedCatalogOrError(parsed.data.catalogId, ownerId);
    if ('error' in ownership) {
      return ownership.error;
    }

    if (parsed.data.bookshelfId) {
      const bookshelf = await prisma.bookshelf.findUnique({
        where: { id: parsed.data.bookshelfId },
        select: { userId: true },
      });

      if (!bookshelf) {
        return NextResponse.json({ error: 'BOOKSHELF_NOT_FOUND' }, { status: 404 });
      }

      if (bookshelf.userId !== ownerId) {
        return NextResponse.json({ error: 'BOOKSHELF_FORBIDDEN' }, { status: 403 });
      }
    }

    const record = await prisma.catalog.update({
      where: { id: parsed.data.catalogId },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description,
        sourcePdfUrl: parsed.data.sourcePdfUrl,
        bookshelfId: parsed.data.bookshelfId,
      },
      include: {
        items: true,
        publication: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
        if (target.includes('userId') && target.includes('slug')) {
          return NextResponse.json({ error: 'CATALOG_SLUG_CONFLICT' }, { status: 409 });
        }
      }

      if (error.code === 'P2003') {
        return NextResponse.json({ error: 'INVALID_RELATION' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: CatalogRouteContext) {
  const { catalogId } = await context.params;
  const limiter = checkRateLimit('catalogs:delete', { limit: 40, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);

    const ownership = await resolveOwnedCatalogOrError(catalogId, ownerId);
    if ('error' in ownership) {
      return ownership.error;
    }

    const record = await prisma.catalog.update({
      where: { id: catalogId },
      data: {
        status: 'ARCHIVED',
      },
      include: {
        publication: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }

    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
