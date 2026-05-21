import { NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer';
import { checkRateLimit } from '../../../../lib/security/rate-limit';
import { AuthError, requireAuthenticatedUserId } from '../../../../lib/server/auth';
import { prisma } from '../../../../lib/server/prisma';

export const runtime = 'nodejs';

type CatalogExportRouteContext = {
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

export async function GET(request: Request, context: CatalogExportRouteContext) {
  const { catalogId } = await context.params;
  const limiter = checkRateLimit('catalogs:export:get', { limit: 10, windowMs: 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED', resetAt: limiter.resetAt }, { status: 429 });
  }

  try {
    const ownerId = await requireAuthenticatedUserId(request);
    const ownership = await resolveOwnedCatalogOrError(catalogId, ownerId);
    if ('error' in ownership) {
      return ownership.error;
    }

    const publication = await prisma.publication.findUnique({
      where: { catalogId },
      select: {
        publicSlug: true,
        status: true,
      },
    });

    if (!publication || publication.status !== 'PUBLISHED' || !publication.publicSlug) {
      return NextResponse.json(
        {
          error: 'CATALOG_NOT_PUBLISHED_FOR_EXPORT',
          message: 'El catálogo debe estar publicado para poder exportarse a PDF',
        },
        { status: 400 },
      );
    }

    const publicCatalogUrl = new URL(`/c/${publication.publicSlug}`, request.url).toString();
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(publicCatalogUrl, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          bottom: '1cm',
        },
      });

      const pdfBytes = new Uint8Array(pdfBuffer.byteLength);
      pdfBytes.set(pdfBuffer);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      return new NextResponse(pdfBlob, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="catalogo.pdf"',
        },
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }

    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
