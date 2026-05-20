import { NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { publishCatalogSchema } from '../../../../lib/contracts/catalog';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { prisma } from '../../../../lib/server/prisma';

const defaultOwnerId = 'demo-owner';

type PublishRouteContext = {
  params: {
    catalogId: string;
  };
};

function hashPublicationPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(digest).toString('hex')}`;
}

export async function POST(request: Request, context: PublishRouteContext) {
  const limiter = checkRateLimit('catalogs:publish', { limit: 40, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json();
  const parsed = publishCatalogSchema.safeParse({
    ...body,
    catalogId: context.params.catalogId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ownerId = request.headers.get('x-user-id') ?? defaultOwnerId;
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
    const passwordHash = parsed.data.password ? hashPublicationPassword(parsed.data.password) : null;

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
