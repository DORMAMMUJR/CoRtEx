import { createHash, randomBytes } from 'node:crypto';
import type { AuthProvider } from '@prisma/client';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'cmk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getCookieValue(cookieHeader: string, cookieName: string) {
  const cookieParts = cookieHeader.split(';');
  for (const rawPart of cookieParts) {
    const part = rawPart.trim();
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    const value = part.slice(separatorIndex + 1);
    return decodeURIComponent(value);
  }

  return null;
}

export function sessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function createOAuthStateCookieName(provider: AuthProvider) {
  return `cmk_oauth_state_${provider.toLowerCase()}`;
}

export function createOAuthState() {
  return randomBytes(24).toString('base64url');
}

export async function createUserSession(userId: string, request: Request) {
  const plainToken = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(plainToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    },
  });

  return {
    token: plainToken,
    expiresAt,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function resolveSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      user: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  };
}
