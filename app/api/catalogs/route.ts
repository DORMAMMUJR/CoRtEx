import { NextResponse } from 'next/server';
import { catalogQuerySchema, createCatalogSchema } from '../../lib/contracts/catalog';
import { checkRateLimit } from '../../lib/security/rate-limit';
import { createCatalog, listCatalogs } from '../../lib/server/catalog-store';

const defaultOwnerId = 'demo-owner';

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

  const records = await listCatalogs(parsed.data.ownerId, parsed.data.status);
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
    const ownerId = request.headers.get('x-user-id') ?? defaultOwnerId;
    const record = await createCatalog(ownerId, parsed.data);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    if (code === 'CATALOG_SLUG_CONFLICT') {
      return NextResponse.json({ error: code }, { status: 409 });
    }

    if (code === 'BOOKSHELF_NOT_FOUND') {
      return NextResponse.json({ error: code }, { status: 404 });
    }

    if (code === 'BOOKSHELF_FORBIDDEN') {
      return NextResponse.json({ error: code }, { status: 403 });
    }

    if (code === 'INVALID_RELATION') {
      return NextResponse.json({ error: code }, { status: 400 });
    }

    return NextResponse.json({ error: code }, { status: 500 });
  }
}
