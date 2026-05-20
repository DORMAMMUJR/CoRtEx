import { NextResponse } from 'next/server';
import { oauthProviderSchema } from '../../../../../lib/contracts/auth';
import { buildOAuthAuthorizeUrl, getProviderConfig, resolveAppBaseUrl } from '../../../../../lib/server/oauth';
import { createOAuthState, createOAuthStateCookieName } from '../../../../../lib/server/session';

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success) {
    return NextResponse.json({ error: 'OAUTH_UNSUPPORTED_PROVIDER' }, { status: 400 });
  }

  try {
    const config = getProviderConfig(parsedProvider.data);
    const state = createOAuthState();
    const cookieName = createOAuthStateCookieName(config.provider);
    const baseUrl = resolveAppBaseUrl(request);
    const callbackUrl = `${baseUrl}/api/auth/oauth/${parsedProvider.data}/callback`;
    const authorizeUrl = buildOAuthAuthorizeUrl(config, callbackUrl, state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(cookieName, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = code === 'OAUTH_NOT_CONFIGURED' ? 503 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
