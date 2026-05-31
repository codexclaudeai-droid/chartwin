import {
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
  validatePasswordPolicy,
  type Actor,
} from '../../domain/chart-service/index.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createPasswordHash, verifyPasswordHash } from './passwords.ts';
import {
  createUniqueRandomReferralCode,
  normalizeReferralCode,
} from './referral-codes.ts';
import type { AuthSessionRecord, ChartServiceRepository, ServiceUserRecord } from './repository.ts';

export const SESSION_COOKIE_NAME = 'tc_chart_session';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SIGNED_SESSION_VERSION = 'v1';
const DEFAULT_LOCAL_SESSION_SECRET = 'tc-chart-local-session-secret';
type SessionCookieOptions = {
  nodeEnv?: string;
  secure?: boolean;
  userId?: string;
  expiresAt?: string;
  sessionSecret?: string;
};
export type SessionCookieClaims = {
  sessionId: string;
  userId?: string;
  expiresAt?: string;
  signed: boolean;
};

export function createSessionForUser(
  repository: ChartServiceRepository,
  input: { userId: string; createdAt: string; ttlSeconds?: number },
): { session: AuthSessionRecord; cookie: string } {
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);
  if (user.accountStatus === USER_ACCOUNT_STATUSES.suspended) {
    throw new Error('Account suspended');
  }

  const ttlSeconds = input.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = new Date(new Date(input.createdAt).getTime() + ttlSeconds * 1000).toISOString();
  const session: AuthSessionRecord = {
    id: repository.nextId('session'),
    userId: input.userId,
    createdAt: input.createdAt,
    expiresAt,
  };

  repository.saveSession(session);
  return {
    session,
    cookie: createSessionCookie(session.id, ttlSeconds, {
      userId: session.userId,
      expiresAt: session.expiresAt,
    }),
  };
}

export function registerMockUserAccount(
  repository: ChartServiceRepository,
  input: {
    email: string;
    name: string;
    password: string;
    createdAt: string;
    referralCode?: string | null;
    phoneNumber?: string | null;
  },
): { user: ServiceUserRecord; session: AuthSessionRecord; cookie: string } {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new Error('Invalid email');
  }
  const policy = validatePasswordPolicy(input.password);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }
  if (repository.getUserByEmail(email)) {
    throw new Error('Email already registered');
  }
  const referredByUserId = getReferrerUserIdByReferralCode(repository, input.referralCode);

  const user: ServiceUserRecord = {
    id: repository.nextId('user'),
    email,
    name: input.name.trim() || email,
    role: USER_ROLES.member,
    accountStatus: USER_ACCOUNT_STATUSES.active,
    phoneNumber: normalizeSignupPhoneNumber(input.phoneNumber),
    profileImageDataUrl: null,
    referralCode: '',
    referredByUserId,
    createdAt: input.createdAt,
    passwordHash: createPasswordHash(input.password),
  };
  user.referralCode = createUniqueRandomReferralCode(repository.listUsers().map((item) => item.referralCode));
  repository.saveUser(user);
  const { session, cookie } = createSessionForUser(repository, {
    userId: user.id,
    createdAt: input.createdAt,
  });
  return { user, session, cookie };
}

function getReferrerUserIdByReferralCode(
  repository: ChartServiceRepository,
  referralCode: string | null | undefined,
): string | null {
  const normalizedReferralCode = normalizeSignupReferralCode(referralCode);
  if (!normalizedReferralCode) return null;

  const referrer = repository
    .listUsers()
    .find((user) => normalizeSignupReferralCode(user.referralCode) === normalizedReferralCode);
  if (!referrer) throw new Error('Referral code not found');

  return referrer.id;
}

function normalizeSignupReferralCode(value: string | null | undefined): string {
  return normalizeReferralCode(value);
}

function normalizeSignupPhoneNumber(value: string | null | undefined): string | null {
  const phoneNumber = String(value ?? '').trim();
  if (!phoneNumber) return null;
  if (phoneNumber.length > 30) throw new Error('Contact phone number too long');
  if (!/^[0-9+\-().\s]{7,30}$/.test(phoneNumber)) {
    throw new Error('Contact phone number invalid');
  }
  return phoneNumber;
}

export function authenticateUserWithPassword(
  repository: ChartServiceRepository,
  input: { email: string; password: string; createdAt: string; ttlSeconds?: number },
): { user: ServiceUserRecord; session: AuthSessionRecord; cookie: string } {
  const email = input.email.trim().toLowerCase();
  const user = repository.getUserByEmail(email);
  if (!user || !verifyPasswordHash(input.password, user.passwordHash)) {
    throw new Error('Invalid email or password');
  }

  const { session, cookie } = createSessionForUser(repository, {
    userId: user.id,
    createdAt: input.createdAt,
    ttlSeconds: input.ttlSeconds,
  });
  return { user, session, cookie };
}

export function getActorFromSession(
  repository: ChartServiceRepository,
  sessionInput: string | SessionCookieClaims | null,
  nowIso: string,
): Actor {
  if (!sessionInput) throw new Error('Session required');

  const claims = typeof sessionInput === 'string'
    ? { sessionId: sessionInput, signed: false }
    : sessionInput;
  const session = repository.getSessionById(claims.sessionId);
  const userId = session?.userId ?? (claims.signed ? claims.userId : undefined);
  const expiresAt = session?.expiresAt ?? (claims.signed ? claims.expiresAt : undefined);

  if (!userId || !expiresAt) throw new Error('Session not found');
  if (new Date(expiresAt).getTime() <= new Date(nowIso).getTime()) {
    if (session) repository.deleteSession(session.id);
    throw new Error('Session expired');
  }

  const user = repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.accountStatus === USER_ACCOUNT_STATUSES.suspended) {
    if (session) repository.deleteSession(session.id);
    throw new Error('Account suspended');
  }
  return { id: user.id, role: user.role };
}

export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  return parseSessionCookieClaims(cookieHeader)?.sessionId ?? null;
}

export function parseSessionCookieClaims(cookieHeader: string | null | undefined): SessionCookieClaims | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) return null;

  const value = decodeURIComponent(match.slice(prefix.length));
  return readSignedSessionCookieValue(value) ?? readUnsignedSessionIdFromSignedCookieValue(value) ?? {
    sessionId: value,
    signed: false,
  };
}

export function shouldUseSecureSessionCookie(options: SessionCookieOptions = {}): boolean {
  if (typeof options.secure === 'boolean') {
    return options.secure;
  }

  return (options.nodeEnv ?? process.env.NODE_ENV) === 'production';
}

export function createSessionCookie(
  sessionId: string,
  maxAgeSeconds = DEFAULT_SESSION_TTL_SECONDS,
  options: SessionCookieOptions = {},
): string {
  const cookieValue = options.userId && options.expiresAt
    ? createSignedSessionCookieValue({
      sessionId,
      userId: options.userId,
      expiresAt: options.expiresAt,
    }, options)
    : sessionId;
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (shouldUseSecureSessionCookie(options)) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

function createSignedSessionCookieValue(
  claims: Omit<SessionCookieClaims, 'signed'>,
  options: SessionCookieOptions = {},
): string {
  const payload = base64UrlEncode(JSON.stringify({
    sid: claims.sessionId,
    uid: claims.userId,
    exp: claims.expiresAt,
  }));
  const signature = signSessionPayload(payload, options);
  return `${SIGNED_SESSION_VERSION}.${payload}.${signature}`;
}

function readSignedSessionCookieValue(
  value: string,
  options: SessionCookieOptions = {},
): SessionCookieClaims | null {
  const [version, payload, signature, ...rest] = value.split('.');
  if (version !== SIGNED_SESSION_VERSION || !payload || !signature || rest.length > 0) {
    return null;
  }
  const expectedSignature = signSessionPayload(payload, options);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (!decoded?.sid || !decoded?.uid || !decoded?.exp) return null;
    return {
      sessionId: String(decoded.sid),
      userId: String(decoded.uid),
      expiresAt: String(decoded.exp),
      signed: true,
    };
  } catch {
    return null;
  }
}

function readUnsignedSessionIdFromSignedCookieValue(value: string): SessionCookieClaims | null {
  const [version, payload, signature, ...rest] = value.split('.');
  if (version !== SIGNED_SESSION_VERSION || !payload || !signature || rest.length > 0) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (!decoded?.sid) return null;
    return {
      sessionId: String(decoded.sid),
      signed: false,
    };
  } catch {
    return null;
  }
}

function signSessionPayload(payload: string, options: SessionCookieOptions = {}): string {
  return createHmac('sha256', getSessionSecret(options))
    .update(payload)
    .digest('base64url');
}

function getSessionSecret(options: SessionCookieOptions = {}): string {
  const mode = options.nodeEnv ?? process.env.NODE_ENV;
  const secret = (options.sessionSecret ?? process.env.CHART_SERVICE_SESSION_SECRET)?.trim();
  if (secret && (mode !== 'production' || secret.length >= 32)) return secret;
  if (mode === 'production') {
    throw new Error('CHART_SERVICE_SESSION_SECRET is required in production');
  }
  return DEFAULT_LOCAL_SESSION_SECRET;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function createClearSessionCookie(options: SessionCookieOptions = {}): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (shouldUseSecureSessionCookie(options)) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
