import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(input: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(input, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(digest).toString('hex')}`;
}

export function verifyPassword(input: string, storedHash: string) {
  const [saltHex, digestHex] = storedHash.split(':');
  if (!saltHex || !digestHex) {
    return false;
  }

  const digest = scryptSync(input, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(digestHex, 'hex');
  if (digest.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(digest, expected);
}
