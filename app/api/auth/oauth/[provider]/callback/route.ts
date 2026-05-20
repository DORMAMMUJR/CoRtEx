import { NextResponse } from 'next/server';
import { oauthCallbackQuerySchema, oauthProviderSchema } from '../../../../../lib/contracts/auth';
import { getProviderConfig, resolveAppBaseUrl, resolveOrCreateOAuthUser } from '../../../../../lib/server/oauth';
import { createOAuthStateCookieName, createUserSession, sessionCookieName } from '../../../../../lib/server/session';

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success) {
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
    const config = getProviderConfig(parsedProvider.data);
    const stateCookieName = createOAuthStateCookieName(config.provider);
    const stateCookie = request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${stateCookieName}=`))
      ?.slice(stateCookieName.length + 1);

    if (!stateCookie || stateCookie !== parsedQuery.data.state) {
      return NextResponse.json({ error: 'OAUTH_STATE_INVALID' }, { status: 400 });
    }

    const baseUrl = resolveAppBaseUrl(request);
    const callbackUrl = `${baseUrl}/api/auth/oauth/${parsedProvider.data}/callback`;

    const userId = await resolveOrCreateOAuthUser(config, parsedQuery.data.code, callbackUrl);
    const session = await createUserSession(userId, request);

    const response = NextResponse.redirect(new URL('/dashboard', request.url));
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
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    if (
      code === 'OAUTH_NOT_CONFIGURED' ||
      code === 'OAUTH_TOKEN_EXCHANGE_FAILED' ||
      code === 'OAUTH_PROFILE_FETCH_FAILED' ||
      code === 'OAUTH_EMAIL_REQUIRED' ||
      code === 'OAUTH_STATE_INVALID' ||
      code === 'OAUTH_ACCOUNT_CONFLICT'
    ) {
      const statusByCode: Record<string, number> = {
        OAUTH_NOT_CONFIGURED: 503,
        OAUTH_TOKEN_EXCHANGE_FAILED: 401,
        OAUTH_PROFILE_FETCH_FAILED: 401,
        OAUTH_EMAIL_REQUIRED: 400,
        OAUTH_STATE_INVALID: 400,
        OAUTH_ACCOUNT_CONFLICT: 409,
      };

      return NextResponse.json({ error: code }, { status: statusByCode[code] ?? 400 });
    }

    return NextResponse.json({ error: code }, { status: 500 });
  }
}
