import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const PASSWORD_HASH_ALGORITHM = 'pbkdf2_sha256';
const PASSWORD_HASH_ITERATIONS = 100_000;
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

  const actual = safelyCreatePbkdf2Hash(password, salt, iterations);
  if (!actual) return false;

  const expected = Buffer.from(expectedHash, 'base64url');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function getPasswordHashIterations(encodedHash: string | null | undefined): number | null {
  if (!encodedHash) return null;

  const [algorithm, iterationsValue] = encodedHash.split('$');
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !iterationsValue) return null;

  const iterations = Number(iterationsValue);
  return Number.isSafeInteger(iterations) && iterations > 0 ? iterations : null;
}

export function isPasswordHashRuntimeCompatible(encodedHash: string | null | undefined): boolean {
  const iterations = getPasswordHashIterations(encodedHash);
  return iterations !== null && iterations <= PASSWORD_HASH_ITERATIONS;
}

function safelyCreatePbkdf2Hash(password: string, salt: string, iterations: number): Buffer | null {
  try {
    return pbkdf2Sync(
      password,
      salt,
      iterations,
      PASSWORD_HASH_KEY_LENGTH,
      PASSWORD_HASH_DIGEST,
    );
  } catch {
    return null;
  }
}
