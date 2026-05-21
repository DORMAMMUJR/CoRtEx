import type { AuthProvider } from '@prisma/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from './prisma';

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHORIZED') {
    super(code);
    this.name = 'AuthError';
  }
}

function resolveAuthProvider(provider: unknown): AuthProvider | null {
  if (provider === 'google') {
    return 'GOOGLE';
  }
  if (provider === 'facebook') {
    return 'FACEBOOK';
  }
  return null;
}

function normalizeMetadataString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function extractProfileMetadata(user: SupabaseUser) {
  const fullName =
    normalizeMetadataString(user.user_metadata?.full_name) ?? normalizeMetadataString(user.user_metadata?.name);
  const avatarUrl =
    normalizeMetadataString(user.user_metadata?.avatar_url) ?? normalizeMetadataString(user.user_metadata?.picture);

  return { fullName, avatarUrl };
}

export async function syncSupabaseUserToAppUser(user: SupabaseUser) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new AuthError('UNAUTHORIZED');
  }

  const { fullName, avatarUrl } = extractProfileMetadata(user);
  const appUser = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: fullName ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
      isActive: true,
      lastLoginAt: new Date(),
    },
    create: {
      email,
      fullName: fullName ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
      isActive: true,
      lastLoginAt: new Date(),
      profile: {
        create: {},
      },
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!appUser.isActive) {
    throw new AuthError('UNAUTHORIZED');
  }

  const provider = resolveAuthProvider(user.app_metadata?.provider);
  if (provider) {
    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: user.id,
        },
      },
      create: {
        userId: appUser.id,
        provider,
        providerAccountId: user.id,
      },
      update: {
        userId: appUser.id,
      },
    });
  }

  return appUser.id;
}

async function resolveAuthenticatedAppUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('UNAUTHORIZED');
  }

  return syncSupabaseUserToAppUser(user);
}

export async function requireAuthenticatedUserId(_request: Request) {
  return resolveAuthenticatedAppUserId();
}

export async function requireAuthenticatedPageUserId() {
  return resolveAuthenticatedAppUserId();
}
