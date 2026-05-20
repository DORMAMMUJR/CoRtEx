import { randomBytes, scryptSync } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CreateCatalogInput, PublishCatalogInput } from '../contracts/catalog';
import { prisma } from './prisma';

type CatalogListStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

type CatalogStoreErrorCode =
  | 'CATALOG_NOT_FOUND'
  | 'CATALOG_FORBIDDEN'
  | 'CATALOG_SLUG_CONFLICT'
  | 'PUBLICATION_SLUG_CONFLICT'
  | 'BOOKSHELF_NOT_FOUND'
  | 'BOOKSHELF_FORBIDDEN'
  | 'INVALID_RELATION';

class CatalogStoreError extends Error {
  constructor(public readonly code: CatalogStoreErrorCode) {
    super(code);
    this.name = 'CatalogStoreError';
  }
}

function hashPublicationPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(digest).toString('hex')}`;
}

function toCatalogStatus(status: CatalogListStatus): Prisma.CatalogStatus {
  if (status === 'DRAFT') {
    return 'DRAFT';
  }
  if (status === 'PUBLISHED') {
    return 'PUBLISHED';
  }
  return 'ARCHIVED';
}

function toCatalogStoreError(error: unknown): never {
  if (error instanceof CatalogStoreError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
      if (target.includes('userId') && target.includes('slug')) {
        throw new CatalogStoreError('CATALOG_SLUG_CONFLICT');
      }
      if (target.includes('publicSlug')) {
        throw new CatalogStoreError('PUBLICATION_SLUG_CONFLICT');
      }
    }

    if (error.code === 'P2003') {
      throw new CatalogStoreError('INVALID_RELATION');
    }
  }

  throw error;
}

export async function listCatalogs(ownerId?: string, status?: CatalogListStatus) {
  return prisma.catalog.findMany({
    where: {
      userId: ownerId,
      status: status ? toCatalogStatus(status) : undefined,
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
}

export async function createCatalog(ownerId: string, input: CreateCatalogInput) {
  try {
    if (input.bookshelfId) {
      const bookshelf = await prisma.bookshelf.findUnique({
        where: { id: input.bookshelfId },
        select: { userId: true },
      });

      if (!bookshelf) {
        throw new CatalogStoreError('BOOKSHELF_NOT_FOUND');
      }
      if (bookshelf.userId !== ownerId) {
        throw new CatalogStoreError('BOOKSHELF_FORBIDDEN');
      }
    }

    return await prisma.catalog.create({
      data: {
        userId: ownerId,
        title: input.title,
        slug: input.slug,
        description: input.description,
        sourcePdfUrl: input.sourcePdfUrl,
        bookshelfId: input.bookshelfId,
        items: input.items.length
          ? {
              create: input.items.map((item, index) => ({
                position: index,
                type: item.type,
                name: item.name,
                description: item.description,
                price: item.price,
                currency: item.currency,
                imageUrl: item.imageUrl,
                metadata: item.metadata,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
        publication: true,
      },
    });
  } catch (error) {
    toCatalogStoreError(error);
  }
}

export async function publishCatalog(ownerId: string, input: PublishCatalogInput) {
  try {
    const catalog = await prisma.catalog.findUnique({
      where: { id: input.catalogId },
      select: { id: true, userId: true },
    });

    if (!catalog) {
      throw new CatalogStoreError('CATALOG_NOT_FOUND');
    }

    if (catalog.userId !== ownerId) {
      throw new CatalogStoreError('CATALOG_FORBIDDEN');
    }

    const now = new Date();
    const passwordHash = input.password ? hashPublicationPassword(input.password) : null;

    const [updatedCatalog] = await prisma.$transaction([
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
          visibility: input.visibility,
          publicSlug: input.publicSlug,
          passwordHash,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          socialImageUrl: input.socialImageUrl,
          publishedAt: now,
        },
        update: {
          status: 'PUBLISHED',
          visibility: input.visibility,
          publicSlug: input.publicSlug,
          passwordHash,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          socialImageUrl: input.socialImageUrl,
          publishedAt: now,
        },
      }),
    ]);

    return updatedCatalog;
  } catch (error) {
    toCatalogStoreError(error);
  }
}
