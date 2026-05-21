import { NextResponse } from 'next/server';
import { oauthProviderSchema } from '../../../../../lib/contracts/auth';
import { createOAuthState, createOAuthStateCookieName } from '../../../../../lib/server/session';

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

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success || parsedProvider.data !== 'google') {
    return NextResponse.json({ error: 'OAUTH_UNSUPPORTED_PROVIDER' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'OAUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  const baseUrl = resolveCanonicalBaseUrl(request);
  const callbackUrl = `${baseUrl}/api/auth/oauth/google/callback`;
  const state = createOAuthState();
  const stateCookieName = createOAuthStateCookieName('GOOGLE');

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid email profile');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(stateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
