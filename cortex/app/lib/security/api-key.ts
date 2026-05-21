import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type GeneratedApiKey = {
  plainKey: string;
  keyPrefix: string;
  keyHash: string;
};

const API_KEY_PREFIX = 'cmk';

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString('hex');
  const plainKey = `${API_KEY_PREFIX}_${secret}`;
  const keyPrefix = plainKey.slice(0, 10);
  return {
    plainKey,
    keyPrefix,
    keyHash: hashApiKey(plainKey),
  };
}

export function hashApiKey(input: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(input, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(digest).toString('hex')}`;
}

export function verifyApiKey(input: string, storedHash: string) {
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
