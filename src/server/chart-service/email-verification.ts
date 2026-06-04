import { createHash, randomBytes } from 'node:crypto';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { EmailOutboxRecord, EmailVerificationTokenRecord, ServiceUserRecord } from './repository.ts';

const DEFAULT_EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
export const EMAIL_VERIFICATION_SENDER_EMAIL = 'verify@tradingcore.co';

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
    senderEmail: EMAIL_VERIFICATION_SENDER_EMAIL,
    recipientEmail: input.user.email,
    template: 'email_verification',
    subject: 'Verify your TradingCore email',
    body: [
      'TradingCore 가입을 완료하려면 아래 링크를 눌러 이메일 주소를 인증하세요.',
      verifyUrl,
      '',
      `이 인증 링크는 한국시간 ${formatKstDateTime(expiresAt)} (KST)에 만료됩니다.`,
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
    verifyUrlBase?: string;
  },
): Promise<{ accepted: true; queued: boolean; emailOutboxId: string | null }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return { accepted: true, queued: false, emailOutboxId: null };
  }

  const user = await repository.getUserByEmail(email);
  if (!user || user.emailVerifiedAt) {
    return { accepted: true, queued: false, emailOutboxId: null };
  }

  const verification = await queueAsyncEmailVerification(repository, {
    user,
    requestedAt: input.requestedAt,
    verifyUrlBase: input.verifyUrlBase,
  });
  return { accepted: true, queued: true, emailOutboxId: verification.emailOutboxId };
}

function createEmailVerificationUrl(token: string, verifyUrlBase?: string): string {
  const base = verifyUrlBase?.trim() || '/verify-email';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

function formatKstDateTime(isoDate: string): string {
  const kstDate = new Date(new Date(isoDate).getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  const hour = String(kstDate.getUTCHours()).padStart(2, '0');
  const minute = String(kstDate.getUTCMinutes()).padStart(2, '0');
  const second = String(kstDate.getUTCSeconds()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분 ${second}초`;
}
