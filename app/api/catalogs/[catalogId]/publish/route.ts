import { NextResponse } from 'next/server';
import { publishCatalogSchema } from '../../../../lib/contracts/catalog';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { publishCatalog } from '../../../../lib/server/catalog-store';

const defaultOwnerId = 'demo-owner';

type PublishRouteContext = {
  params: {
    catalogId: string;
  };
};

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
    const data = await publishCatalog(ownerId, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    if (code === 'CATALOG_NOT_FOUND') {
      return NextResponse.json({ error: code }, { status: 404 });
    }

    if (code === 'CATALOG_FORBIDDEN') {
      return NextResponse.json({ error: code }, { status: 403 });
    }

    if (code === 'PUBLICATION_SLUG_CONFLICT') {
      return NextResponse.json({ error: code }, { status: 409 });
    }

    return NextResponse.json({ error: code }, { status: 500 });
  }
}
