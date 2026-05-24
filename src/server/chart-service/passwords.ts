import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const PASSWORD_HASH_ALGORITHM = 'pbkdf2_sha256';
const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = 'sha256';

export type PasswordHashOptions = {
  salt?: string;
  iterations?: number;
};

export function createPasswordHash(password: string, options: PasswordHashOptions = {}): string {
  const iterations = options.iterations ?? PASSWORD_HASH_ITERATIONS;
  const salt = options.salt ?? randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST,
  ).toString('base64url');

  return `${PASSWORD_HASH_ALGORITHM}$${iterations}$${salt}$${hash}`;
}

export function verifyPasswordHash(password: string, encodedHash: string | null | undefined): boolean {
  if (!encodedHash) return false;

  const [algorithm, iterationsValue, salt, expectedHash] = encodedHash.split('$');
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !iterationsValue || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    return false;
  }

  const actual = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST,
  );
  const expected = Buffer.from(expectedHash, 'base64url');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
