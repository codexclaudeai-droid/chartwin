import { createHash, randomBytes } from 'node:crypto';
import { validatePasswordPolicy } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import { createPasswordHash } from './passwords.ts';
import type { PasswordResetTokenRecord, ServiceUserRecord } from './repository.ts';

const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export type PasswordResetRequestResult = {
  accepted: true;
  created: boolean;
  token: string | null;
  expiresAt: string | null;
};

export function createPasswordResetTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function requestAsyncPasswordReset(
  repository: AsyncChartServiceRepository,
  input: {
    email: string;
    requestedAt: string;
    token?: string;
    ttlSeconds?: number;
  },
): Promise<PasswordResetRequestResult> {
  const email = input.email.trim().toLowerCase();
  const user = email ? await repository.getUserByEmail(email) : null;
  if (!user) {
    return {
      accepted: true,
      created: false,
      token: null,
      expiresAt: null,
    };
  }

  const token = input.token ?? createPasswordResetToken();
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_PASSWORD_RESET_TTL_SECONDS;
  const expiresAt = new Date(new Date(input.requestedAt).getTime() + ttlSeconds * 1000).toISOString();
  const record: PasswordResetTokenRecord = {
    id: await repository.nextId('password_reset'),
    userId: user.id,
    tokenHash: createPasswordResetTokenHash(token),
    createdAt: input.requestedAt,
    expiresAt,
    usedAt: null,
  };

  await repository.savePasswordResetToken(record);
  return {
    accepted: true,
    created: true,
    token,
    expiresAt,
  };
}

export async function resetAsyncPasswordWithToken(
  repository: AsyncChartServiceRepository,
  input: {
    token: string;
    password: string;
    resetAt: string;
  },
): Promise<{ user: ServiceUserRecord }> {
  const record = await repository.getPasswordResetTokenByTokenHash(createPasswordResetTokenHash(input.token));
  if (!record) {
    throw new Error('Password reset token not found');
  }
  if (record.usedAt) {
    throw new Error('Password reset token already used');
  }
  if (new Date(record.expiresAt).getTime() <= new Date(input.resetAt).getTime()) {
    throw new Error('Password reset token expired');
  }

  const policy = validatePasswordPolicy(input.password);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }

  const user = await repository.getUserById(record.userId);
  if (!user) {
    throw new Error(`User not found: ${record.userId}`);
  }

  const updatedUser: ServiceUserRecord = {
    ...user,
    passwordHash: createPasswordHash(input.password),
  };
  await repository.saveUser(updatedUser);
  await repository.savePasswordResetToken({
    ...record,
    usedAt: input.resetAt,
  });
  const sessions = await repository.listSessionsByUserId(user.id);
  await Promise.all(sessions.map((session) => repository.deleteSession(session.id)));

  return {
    user: updatedUser,
  };
}

