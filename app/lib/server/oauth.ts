import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type OAuthProvider = 'GOOGLE' | 'FACEBOOK';

type OAuthProviderConfig = {
  provider: OAuthProvider;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
};

type NormalizedOAuthProfile = {
  providerAccountId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
};

type OAuthTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

class OAuthFlowError extends Error {
  constructor(
    public readonly code:
      | 'OAUTH_UNSUPPORTED_PROVIDER'
      | 'OAUTH_NOT_CONFIGURED'
      | 'OAUTH_TOKEN_EXCHANGE_FAILED'
      | 'OAUTH_PROFILE_FETCH_FAILED'
      | 'OAUTH_EMAIL_REQUIRED'
      | 'OAUTH_STATE_INVALID'
      | 'OAUTH_ACCOUNT_CONFLICT',
  ) {
    super(code);
    this.name = 'OAuthFlowError';
  }
}

const providerConfigs: Record<Lowercase<OAuthProvider>, OAuthProviderConfig> = {
  google: {
    provider: 'GOOGLE',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  facebook: {
    provider: 'FACEBOOK',
    authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: ['email', 'public_profile'],
    clientIdEnv: 'FACEBOOK_OAUTH_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_OAUTH_CLIENT_SECRET',
  },
};

export function getProviderConfig(provider: string) {
  const config = providerConfigs[provider as keyof typeof providerConfigs];
  if (!config) {
    throw new OAuthFlowError('OAUTH_UNSUPPORTED_PROVIDER');
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new OAuthFlowError('OAUTH_NOT_CONFIGURED');
  }

  return {
    ...config,
    clientId,
    clientSecret,
  };
}

export function resolveAppBaseUrl(request: Request) {
  const envBaseUrl = process.env.APP_BASE_URL?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

export function buildOAuthAuthorizeUrl(config: ReturnType<typeof getProviderConfig>, callbackUrl: string, state: string) {
  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForToken(
  config: ReturnType<typeof getProviderConfig>,
  code: string,
  callbackUrl: string,
): Promise<OAuthTokenPayload> {
  if (config.provider === 'GOOGLE') {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: callbackUrl,
        code,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new OAuthFlowError('OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    const token = (await response.json()) as OAuthTokenPayload;

    if (!token.access_token) {
      throw new OAuthFlowError('OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    return token;
  }

  const tokenUrl = new URL(config.tokenUrl);
  tokenUrl.searchParams.set('client_id', config.clientId);
  tokenUrl.searchParams.set('client_secret', config.clientSecret);
  tokenUrl.searchParams.set('redirect_uri', callbackUrl);
  tokenUrl.searchParams.set('code', code);

  const response = await fetch(tokenUrl, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    throw new OAuthFlowError('OAUTH_TOKEN_EXCHANGE_FAILED');
  }

  const token = (await response.json()) as OAuthTokenPayload;

  if (!token.access_token) {
    throw new OAuthFlowError('OAUTH_TOKEN_EXCHANGE_FAILED');
  }

  return token;
}

async function fetchOAuthProfile(config: ReturnType<typeof getProviderConfig>, accessToken: string): Promise<NormalizedOAuthProfile> {
  const response = await fetch(config.userInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new OAuthFlowError('OAUTH_PROFILE_FETCH_FAILED');
  }

  const payload = (await response.json()) as Record<string, unknown>;

  if (config.provider === 'GOOGLE') {
    const providerAccountId = typeof payload.sub === 'string' ? payload.sub : undefined;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : undefined;
    if (!providerAccountId || !email) {
      throw new OAuthFlowError('OAUTH_EMAIL_REQUIRED');
    }

    return {
      providerAccountId,
      email,
      fullName: typeof payload.name === 'string' ? payload.name : undefined,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  }

  const providerAccountId = typeof payload.id === 'string' ? payload.id : undefined;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : undefined;
  const fullName = typeof payload.name === 'string' ? payload.name : undefined;

  const pictureField = payload.picture as { data?: { url?: string } } | undefined;
  const avatarUrl = typeof pictureField?.data?.url === 'string' ? pictureField.data.url : undefined;

  if (!providerAccountId || !email) {
    throw new OAuthFlowError('OAUTH_EMAIL_REQUIRED');
  }

  return {
    providerAccountId,
    email,
    fullName,
    avatarUrl,
  };
}

function toExpiresAt(expiresInSeconds?: number) {
  if (!expiresInSeconds || Number.isNaN(expiresInSeconds)) {
    return null;
  }
  return new Date(Date.now() + expiresInSeconds * 1000);
}

function mapPrismaError(error: unknown): never {
  if (error instanceof OAuthFlowError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new OAuthFlowError('OAUTH_ACCOUNT_CONFLICT');
  }

  throw error;
}

export async function resolveOrCreateOAuthUser(
  config: ReturnType<typeof getProviderConfig>,
  code: string,
  callbackUrl: string,
) {
  try {
    const token = await exchangeCodeForToken(config, code, callbackUrl);
    const profile = await fetchOAuthProfile(config, token.access_token as string);

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: config.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const expiresAt = toExpiresAt(token.expires_in);

      if (account) {
        await tx.oAuthAccount.update({
          where: { id: account.id },
          data: {
            accessToken: typeof token.access_token === 'string' ? token.access_token : null,
            refreshToken: typeof token.refresh_token === 'string' ? token.refresh_token : null,
            expiresAt,
          },
        });

        await tx.user.update({
          where: { id: account.userId },
          data: {
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            lastLoginAt: new Date(),
            isActive: true,
          },
        });

        return account.userId;
      }

      const existingUser = await tx.user.findUnique({
        where: { email: profile.email },
        select: { id: true },
      });

      const userId = existingUser?.id ??
        (
          await tx.user.create({
            data: {
              email: profile.email,
              fullName: profile.fullName,
              avatarUrl: profile.avatarUrl,
              isActive: true,
              lastLoginAt: new Date(),
              profile: {
                create: {},
              },
            },
            select: { id: true },
          })
        ).id;

      await tx.oAuthAccount.create({
        data: {
          userId,
          provider: config.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: typeof token.access_token === 'string' ? token.access_token : null,
          refreshToken: typeof token.refresh_token === 'string' ? token.refresh_token : null,
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date(), isActive: true },
      });

      return userId;
    });

    return result;
  } catch (error) {
    mapPrismaError(error);
  }
}

export { OAuthFlowError };
