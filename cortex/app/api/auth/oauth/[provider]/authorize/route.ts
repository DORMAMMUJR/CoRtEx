import { NextResponse } from 'next/server';
import { oauthProviderSchema } from '../../../../../lib/contracts/auth';
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

export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success || parsedProvider.data !== 'google') {
    return NextResponse.json({ error: 'OAUTH_UNSUPPORTED_PROVIDER' }, { status: 400 });
  }

  const baseUrl = resolveCanonicalBaseUrl(request);
  const callbackUrl = `${baseUrl}/api/auth/oauth/google/callback`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: 'OAUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  return NextResponse.redirect(data.url);
}
