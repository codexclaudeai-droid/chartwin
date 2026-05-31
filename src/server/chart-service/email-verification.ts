import { createHash, randomBytes } from 'node:crypto';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { EmailOutboxRecord, EmailVerificationTokenRecord, ServiceUserRecord } from './repository.ts';

const DEFAULT_EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;

export type EmailVerificationRequestResult = {
  token: string;
  expiresAt: string;
  emailOutboxId: string;
};

export function createEmailVerificationTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function queueAsyncEmailVerification(
  repository: AsyncChartServiceRepository,
  input: {
    user: ServiceUserRecord;
    requestedAt: string;
    token?: string;
    ttlSeconds?: number;
    verifyUrlBase?: string;
  },
): Promise<EmailVerificationRequestResult> {
  const token = input.token ?? createEmailVerificationToken();
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_EMAIL_VERIFICATION_TTL_SECONDS;
  const expiresAt = new Date(new Date(input.requestedAt).getTime() + ttlSeconds * 1000).toISOString();
  const record: EmailVerificationTokenRecord = {
    id: await repository.nextId('email_verify'),
    userId: input.user.id,
    tokenHash: createEmailVerificationTokenHash(token),
    createdAt: input.requestedAt,
    expiresAt,
    usedAt: null,
  };

  await repository.saveEmailVerificationToken(record);
  const verifyUrl = createEmailVerificationUrl(token, input.verifyUrlBase);
  const emailOutboxId = await repository.nextId('email');
  const emailRecord: EmailOutboxRecord = {
    id: emailOutboxId,
    recipientEmail: input.user.email,
    template: 'email_verification',
    subject: 'Verify your TradingCore email',
    body: [
      'Complete your TradingCore signup by verifying this email address:',
      verifyUrl,
      '',
      `This verification link expires at ${expiresAt}.`,
    ].join('\n'),
    status: 'queued',
    createdAt: input.requestedAt,
    sentAt: null,
    lastError: null,
  };
  await repository.saveEmailOutboxRecord(emailRecord);

  return { token, expiresAt, emailOutboxId };
}

export async function verifyAsyncEmailWithToken(
  repository: AsyncChartServiceRepository,
  input: {
    token: string;
    verifiedAt: string;
  },
): Promise<{ user: ServiceUserRecord }> {
  const record = await repository.getEmailVerificationTokenByTokenHash(
    createEmailVerificationTokenHash(input.token),
  );
  if (!record) throw new Error('Email verification token not found');
  if (record.usedAt) throw new Error('Email verification token already used');
  if (new Date(record.expiresAt).getTime() <= new Date(input.verifiedAt).getTime()) {
    throw new Error('Email verification token expired');
  }

  const user = await repository.getUserById(record.userId);
  if (!user) throw new Error(`User not found: ${record.userId}`);

  const updatedUser: ServiceUserRecord = {
    ...user,
    emailVerifiedAt: user.emailVerifiedAt ?? input.verifiedAt,
  };
  await repository.saveUser(updatedUser);
  await repository.saveEmailVerificationToken({
    ...record,
    usedAt: input.verifiedAt,
  });

  return { user: updatedUser };
}

export async function resendAsyncEmailVerification(
  repository: AsyncChartServiceRepository,
  input: {
    email: string;
    requestedAt: string;
  },
): Promise<{ accepted: true; queued: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return { accepted: true, queued: false };
  }

  const user = await repository.getUserByEmail(email);
  if (!user || user.emailVerifiedAt) {
    return { accepted: true, queued: false };
  }

  await queueAsyncEmailVerification(repository, {
    user,
    requestedAt: input.requestedAt,
  });
  return { accepted: true, queued: true };
}

function createEmailVerificationUrl(token: string, verifyUrlBase?: string): string {
  const base = verifyUrlBase?.trim() || '/verify-email';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}
