import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { catalogItemInputSchema } from '../../../../lib/contracts/catalog';
import { entityIdSchema } from '../../../../lib/contracts/common';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { AuthError, requireAuthenticatedUserId } from '../../../../lib/server/auth';
import { prisma } from '../../../../lib/server/prisma';

type CatalogItemsRouteContext = {
  params: Promise<{
    catalogId: string;
  }>;
};

const syncCatalogItemsSchema = z.array(
  catalogItemInputSchema.extend({
    id: entityIdSchema.optional(),
  }),
).max(500);

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

export async function PUT(request: Request, context: CatalogItemsRouteContext) {
  const { catalogId } = await context.params;
  const limiter = checkRateLimit('catalogs:items:put', { limit: 60, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json();
  const parsed = syncCatalogItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);

    const ownership = await resolveOwnedCatalogOrError(catalogId, ownerId);
    if ('error' in ownership) {
      return ownership.error;
    }

    const incomingItems = parsed.data;
    const incomingIds = incomingItems
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string');

    if (incomingIds.length !== new Set(incomingIds).size) {
      return NextResponse.json({ error: 'DUPLICATE_ITEM_IDS' }, { status: 400 });
    }

    const existingItems = await prisma.catalogItem.findMany({
      where: { catalogId },
      select: { id: true },
    });
    const existingIdSet = new Set(existingItems.map((item) => item.id));

    const invalidIds = incomingIds.filter((id) => !existingIdSet.has(id));
    if (invalidIds.length) {
      return NextResponse.json({ error: 'ITEM_NOT_FOUND', itemIds: invalidIds }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (incomingIds.length) {
        await tx.catalogItem.deleteMany({
          where: {
            catalogId,
            id: { notIn: incomingIds },
          },
        });
      } else {
        await tx.catalogItem.deleteMany({ where: { catalogId } });
      }

      for (let position = 0; position < incomingItems.length; position += 1) {
        const item = incomingItems[position];
        const sharedData = {
          position,
          type: item.type,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: item.currency,
          imageUrl: item.imageUrl,
          metadata: item.metadata as Prisma.InputJsonValue | undefined,
        };

        if (item.id) {
          await tx.catalogItem.update({
            where: { id: item.id },
            data: sharedData,
          });
        } else {
          await tx.catalogItem.create({
            data: {
              catalogId,
              ...sharedData,
            },
          });
        }
      }
    });

    const syncedItems = await prisma.catalogItem.findMany({
      where: { catalogId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ data: syncedItems });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return NextResponse.json({ error: 'INVALID_RELATION' }, { status: 400 });
      }

      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'ITEM_NOT_FOUND' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
