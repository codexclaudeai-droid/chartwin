import { createHash, randomInt } from 'node:crypto';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository } from './repository.ts';

export const REFERRAL_CODE_LENGTH = 6;
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function createRandomReferralCode(): string {
  let code = '';
  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

export function createUniqueRandomReferralCode(existingCodes: Iterable<string>): string {
  const normalizedExistingCodes = new Set([...existingCodes].map(normalizeReferralCode));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = createRandomReferralCode();
    if (!normalizedExistingCodes.has(code)) return code;
  }

  throw new Error('Unable to generate unique referral code');
}

export function createStableFallbackReferralCode(seed: string): string {
  return createHash('sha256')
    .update(seed)
    .digest('hex')
    .slice(0, REFERRAL_CODE_LENGTH)
    .toUpperCase();
}

export function ensureRepositoryReferralCodes(
  repository: Pick<ChartServiceRepository, 'listUsers' | 'saveUser'>,
): void {
  const users = repository.listUsers();
  const codeCounts = new Map<string, number>();
  users.forEach((user) => {
    const code = normalizeReferralCode(user.referralCode);
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  });

  const assignedCodes = new Set<string>();
  users.forEach((user) => {
    const normalizedCode = normalizeReferralCode(user.referralCode);
    const canKeepCode = REFERRAL_CODE_PATTERN.test(normalizedCode) &&
      codeCounts.get(normalizedCode) === 1 &&
      !assignedCodes.has(normalizedCode);
    const referralCode = canKeepCode
      ? normalizedCode
      : createAvailableFallbackReferralCode(user.id, assignedCodes);

    assignedCodes.add(referralCode);
    if (user.referralCode !== referralCode) {
      repository.saveUser({ ...user, referralCode });
    }
  });
}

export async function ensureAsyncRepositoryReferralCodes(
  repository: Pick<AsyncChartServiceRepository, 'listUsers' | 'saveUser'>,
): Promise<void> {
  const users = await repository.listUsers();
  const codeCounts = new Map<string, number>();
  users.forEach((user) => {
    const code = normalizeReferralCode(user.referralCode);
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  });

  const assignedCodes = new Set<string>();
  await Promise.all(users.map(async (user) => {
    const normalizedCode = normalizeReferralCode(user.referralCode);
    const canKeepCode = REFERRAL_CODE_PATTERN.test(normalizedCode) &&
      codeCounts.get(normalizedCode) === 1 &&
      !assignedCodes.has(normalizedCode);
    const referralCode = canKeepCode
      ? normalizedCode
      : createAvailableFallbackReferralCode(user.id, assignedCodes);

    assignedCodes.add(referralCode);
    if (user.referralCode !== referralCode) {
      await repository.saveUser({ ...user, referralCode });
    }
  }));
}

export function normalizeReferralCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function createAvailableFallbackReferralCode(seed: string, assignedCodes: Set<string>): string {
  const stableCode = createStableFallbackReferralCode(seed);
  if (!assignedCodes.has(stableCode)) return stableCode;

  return createUniqueRandomReferralCode(assignedCodes);
}
