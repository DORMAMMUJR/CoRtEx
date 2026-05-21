import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { catalogQuerySchema, createCatalogSchema } from '../../lib/contracts/catalog';
import { checkRateLimit } from '../../lib/security/rate-limit';
import { AuthError, requireAuthenticatedUserId } from '../../lib/server/auth';
import { prisma } from '../../lib/server/prisma';

export async function GET(request: Request) {
  const limiter = checkRateLimit('catalogs:get', { limit: 120, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = catalogQuerySchema.safeParse({
    ownerId: searchParams.get('ownerId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 });
  }

  let ownerId: string;
  try {
    ownerId = await requireAuthenticatedUserId(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: code }, { status: 401 });
    }
    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }

  if (parsed.data.ownerId && parsed.data.ownerId !== ownerId) {
    return NextResponse.json({ error: 'FORBIDDEN_OWNER' }, { status: 403 });
  }

  const records = await prisma.catalog.findMany({
    where: {
      userId: ownerId,
      status: parsed.data.status,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      publication: true,
      _count: {
        select: {
          items: true,
          assets: true,
        },
      },
    },
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: Request) {
  const limiter = checkRateLimit('catalogs:post', { limit: 60, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json();
  const parsed = createCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);
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

    const record = await prisma.catalog.create({
      data: {
        userId: ownerId,
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description,
        sourcePdfUrl: parsed.data.sourcePdfUrl,
        bookshelfId: parsed.data.bookshelfId,
        items: parsed.data.items.length
          ? {
              create: parsed.data.items.map((item, index) => ({
                position: index,
                type: item.type,
                name: item.name,
                description: item.description,
                price: item.price,
                currency: item.currency,
                imageUrl: item.imageUrl,
                metadata: item.metadata as Prisma.InputJsonValue | undefined,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
        publication: true,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
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
