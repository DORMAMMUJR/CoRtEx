import { NextResponse } from 'next/server';
import { oauthProviderSchema } from '../../../../../lib/contracts/auth';
import { syncSupabaseUserToAppUser } from '../../../../../lib/server/auth';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

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

function buildErrorRedirect(baseUrl: string, errorCode: string) {
  const destination = new URL('/', baseUrl);
  destination.searchParams.set('error', errorCode);
  return NextResponse.redirect(destination);
}

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success || parsedProvider.data !== 'google') {
    return NextResponse.json({ error: 'OAUTH_UNSUPPORTED_PROVIDER' }, { status: 400 });
  }

  const baseUrl = resolveCanonicalBaseUrl(request);
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    return buildErrorRedirect(baseUrl, 'OAUTH_MISSING_CODE');
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return buildErrorRedirect(baseUrl, 'OAUTH_TOKEN_EXCHANGE_FAILED');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return buildErrorRedirect(baseUrl, 'UNAUTHORIZED');
  }

  try {
    await syncSupabaseUserToAppUser(user);
  } catch {
    return buildErrorRedirect(baseUrl, 'UNAUTHORIZED');
  }

  return NextResponse.redirect(new URL('/dashboard', baseUrl));
}
