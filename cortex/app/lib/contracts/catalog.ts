import { z } from 'zod';
import { entityIdSchema, slugSchema } from './common';

export const catalogItemInputSchema = z.object({
  type: z.enum(['PRODUCT', 'TEXT', 'IMAGE', 'CTA']),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(3000).optional(),
  price: z.number().nonnegative().max(999999.99).optional(),
  currency: z.string().trim().length(3).default('MXN'),
  imageUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createCatalogSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  bookshelfId: entityIdSchema.optional(),
  sourcePdfUrl: z.string().url().optional(),
  items: z.array(catalogItemInputSchema).max(500).default([]),
});

export const updateCatalogSchema = createCatalogSchema.partial().extend({
  catalogId: entityIdSchema,
});

export const publishCatalogSchema = z.object({
  catalogId: entityIdSchema,
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PROTECTED']).default('PUBLIC'),
  publicSlug: slugSchema,
  password: z.string().min(8).max(64).optional(),
  seoTitle: z.string().trim().max(80).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  socialImageUrl: z.string().url().optional(),
});

export const catalogQuerySchema = z.object({
  ownerId: entityIdSchema.optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;
export type UpdateCatalogInput = z.infer<typeof updateCatalogSchema>;
export type PublishCatalogInput = z.infer<typeof publishCatalogSchema>;
export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>;
