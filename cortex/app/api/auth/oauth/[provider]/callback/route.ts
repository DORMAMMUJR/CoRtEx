import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { oauthCallbackQuerySchema, oauthProviderSchema } from '../../../../../lib/contracts/auth';
import { prisma } from '../../../../../lib/server/prisma';
import { createOAuthStateCookieName, createUserSession, sessionCookieName } from '../../../../../lib/server/session';

type RouteContext = {
  params: Promise<{ provider: string }>;
};

function resolveCanonicalBaseUrl(request: Request) {
  const trimmedProd = process.env.APP_BASE_URL?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  if (process.env.NODE_ENV === 'production' && trimmedProd) {
    return trimmedProd.replace(/\/$/, '');
  }

  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const raw of parts) {
    const part = raw.trim();
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    return decodeURIComponent(part.slice(separatorIndex + 1));
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success || parsedProvider.data !== 'google') {
    return NextResponse.json({ error: 'OAUTH_UNSUPPORTED_PROVIDER' }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = oauthCallbackQuerySchema.safeParse({
    code: searchParams.get('code'),
    state: searchParams.get('state'),
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'OAUTH_INVALID_CALLBACK_QUERY', issues: parsedQuery.error.issues }, { status: 400 });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'OAUTH_NOT_CONFIGURED' }, { status: 503 });
    }

    const stateCookieName = createOAuthStateCookieName('GOOGLE');
    const stateCookie = getCookieValue(request.headers.get('cookie'), stateCookieName);

    if (!stateCookie || stateCookie !== parsedQuery.data.state) {
      return NextResponse.json({ error: 'OAUTH_STATE_INVALID' }, { status: 400 });
    }

    const baseUrl = resolveCanonicalBaseUrl(request);
    const callbackUrl = `${baseUrl}/api/auth/oauth/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: parsedQuery.data.code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
      cache: 'no-store',
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'OAUTH_TOKEN_EXCHANGE_FAILED' }, { status: 401 });
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenPayload.access_token) {
      return NextResponse.json({ error: 'OAUTH_TOKEN_EXCHANGE_FAILED' }, { status: 401 });
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
      },
      cache: 'no-store',
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'OAUTH_PROFILE_FETCH_FAILED' }, { status: 401 });
    }

    const profilePayload = (await profileResponse.json()) as Record<string, unknown>;
    const providerAccountId = typeof profilePayload.sub === 'string' ? profilePayload.sub : undefined;
    const email = typeof profilePayload.email === 'string' ? profilePayload.email.trim().toLowerCase() : undefined;
    const fullName = typeof profilePayload.name === 'string' ? profilePayload.name : undefined;
    const avatarUrl = typeof profilePayload.picture === 'string' ? profilePayload.picture : undefined;

    if (!providerAccountId || !email) {
      return NextResponse.json({ error: 'OAUTH_EMAIL_REQUIRED' }, { status: 400 });
    }

    const expiresAt =
      typeof tokenPayload.expires_in === 'number' && !Number.isNaN(tokenPayload.expires_in)
        ? new Date(Date.now() + tokenPayload.expires_in * 1000)
        : null;

    const userId = await prisma.$transaction(async (tx) => {
      const existingAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (existingAccount) {
        await tx.oAuthAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokenPayload.access_token ?? null,
            refreshToken: tokenPayload.refresh_token ?? null,
            expiresAt,
          },
        });

        await tx.user.update({
          where: { id: existingAccount.userId },
          data: {
            fullName,
            avatarUrl,
            lastLoginAt: new Date(),
            isActive: true,
          },
        });

        return existingAccount.userId;
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            fullName,
            avatarUrl,
            lastLoginAt: new Date(),
            isActive: true,
            profile: {
              create: {},
            },
          },
          select: { id: true },
        }));

      const account = await tx.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId,
          },
        },
        create: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId,
          accessToken: tokenPayload.access_token ?? null,
          refreshToken: tokenPayload.refresh_token ?? null,
          expiresAt,
        },
        update: {
          accessToken: tokenPayload.access_token ?? null,
          refreshToken: tokenPayload.refresh_token ?? null,
          expiresAt,
        },
        select: {
          userId: true,
        },
      });

      await tx.user.update({
        where: { id: account.userId },
        data: {
          fullName,
          avatarUrl,
          lastLoginAt: new Date(),
          isActive: true,
        },
      });

      await tx.profile.upsert({
        where: { userId: account.userId },
        create: { userId: account.userId },
        update: {},
      });

      return account.userId;
    });

    const session = await createUserSession(userId, request);

    const response = NextResponse.redirect(new URL('/dashboard', baseUrl));
    response.cookies.set(sessionCookieName(), session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: session.maxAge,
      expires: session.expiresAt,
    });

    response.cookies.set(stateCookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('DETALLES DEL ERROR DEL CALLBACK OAUTH:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'OAUTH_ACCOUNT_CONFLICT' }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
