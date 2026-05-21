import { resolveSessionUser } from './session';

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHORIZED') {
    super(code);
    this.name = 'AuthError';
  }
}

export async function requireAuthenticatedUserId(request: Request) {
  const session = await resolveSessionUser(request);
  if (!session) {
    throw new AuthError('UNAUTHORIZED');
  }

  return session.userId;
}
