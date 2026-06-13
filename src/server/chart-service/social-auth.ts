import { randomBytes } from 'node:crypto';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { USER_ACCOUNT_STATUSES, USER_ROLES } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import { createAsyncSessionForUser } from './async-service.ts';
import { createUniqueRandomReferralCode } from './referral-codes.ts';
import type {
  AuthSessionRecord,
  ServiceUserRecord,
  SocialAuthAccountRecord,
  SocialAuthProvider,
} from './repository.ts';

export const SOCIAL_AUTH_PROVIDERS: SocialAuthProvider[] = ['google', 'naver', 'kakao'];

export type SocialAuthProfile = {
  provider: SocialAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
};

export type SocialAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scope: string;
};

export type SocialAuthRuntimeEnv = {
  CHART_SERVICE_GOOGLE_CLIENT_ID?: string;
  CHART_SERVICE_GOOGLE_CLIENT_SECRET?: string;
  CHART_SERVICE_NAVER_CLIENT_ID?: string;
  CHART_SERVICE_NAVER_CLIENT_SECRET?: string;
  CHART_SERVICE_KAKAO_CLIENT_ID?: string;
  CHART_SERVICE_KAKAO_CLIENT_SECRET?: string;
};

const SOCIAL_AUTH_ENV_KEYS = [
  'CHART_SERVICE_GOOGLE_CLIENT_ID',
  'CHART_SERVICE_GOOGLE_CLIENT_SECRET',
  'CHART_SERVICE_NAVER_CLIENT_ID',
  'CHART_SERVICE_NAVER_CLIENT_SECRET',
  'CHART_SERVICE_KAKAO_CLIENT_ID',
  'CHART_SERVICE_KAKAO_CLIENT_SECRET',
] as const;

export function isSocialAuthProvider(value: string): value is SocialAuthProvider {
  return SOCIAL_AUTH_PROVIDERS.includes(value as SocialAuthProvider);
}

export function createSocialAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export function getSocialAuthStateCookieName(provider: SocialAuthProvider): string {
  return `tc_social_auth_state_${provider}`;
}

export function createSocialAuthStateCookie(provider: SocialAuthProvider, state: string): string {
  return [
    `${getSocialAuthStateCookieName(provider)}=${encodeURIComponent(state)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=600',
  ].join('; ');
}

export function createClearSocialAuthStateCookie(provider: SocialAuthProvider): string {
  return [
    `${getSocialAuthStateCookieName(provider)}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

export function readSocialAuthStateCookie(cookieHeader: string | null | undefined, provider: SocialAuthProvider): string | null {
  if (!cookieHeader) return null;
  const prefix = `${getSocialAuthStateCookieName(provider)}=`;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export function getSocialAuthRuntimeEnv(
  env: SocialAuthRuntimeEnv = process.env as SocialAuthRuntimeEnv,
): SocialAuthRuntimeEnv {
  const cloudflareEnv = getCloudflareSocialAuthEnv();
  return mergeSocialAuthRuntimeEnv(env, cloudflareEnv);
}

export async function getSocialAuthRuntimeEnvAsync(
  env: SocialAuthRuntimeEnv = process.env as SocialAuthRuntimeEnv,
): Promise<SocialAuthRuntimeEnv> {
  const cloudflareEnv = await getCloudflareSocialAuthEnvAsync();
  return mergeSocialAuthRuntimeEnv(env, cloudflareEnv);
}

export function getSocialAuthProviderConfig(
  provider: SocialAuthProvider,
  env: SocialAuthRuntimeEnv = process.env as SocialAuthRuntimeEnv,
): SocialAuthProviderConfig {
  if (provider === 'google') {
    return {
      clientId: requireSocialEnv(env, 'CHART_SERVICE_GOOGLE_CLIENT_ID'),
      clientSecret: requireSocialEnv(env, 'CHART_SERVICE_GOOGLE_CLIENT_SECRET'),
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile',
    };
  }
  if (provider === 'naver') {
    return {
      clientId: requireSocialEnv(env, 'CHART_SERVICE_NAVER_CLIENT_ID'),
      clientSecret: requireSocialEnv(env, 'CHART_SERVICE_NAVER_CLIENT_SECRET'),
      authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
      tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
      userInfoEndpoint: 'https://openapi.naver.com/v1/nid/me',
      scope: '',
    };
  }

  return {
    clientId: requireSocialEnv(env, 'CHART_SERVICE_KAKAO_CLIENT_ID'),
    clientSecret: requireSocialEnv(env, 'CHART_SERVICE_KAKAO_CLIENT_SECRET'),
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
    tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
    userInfoEndpoint: 'https://kapi.kakao.com/v2/user/me',
    scope: 'profile_nickname account_email',
  };
}

export function createSocialAuthAuthorizationUrl(input: {
  provider: SocialAuthProvider;
  requestUrl: string;
  state: string;
  env?: SocialAuthRuntimeEnv;
}): string {
  const config = getSocialAuthProviderConfig(input.provider, input.env);
  const redirectUri = createSocialAuthRedirectUri(input.requestUrl, input.provider);
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', input.state);
  if (config.scope.trim()) {
    url.searchParams.set('scope', config.scope);
  }
  return url.toString();
}

export async function completeAsyncSocialAuth(
  repository: AsyncChartServiceRepository,
  input: {
    profile: SocialAuthProfile;
    createdAt: string;
  },
): Promise<{ user: ServiceUserRecord; session: AuthSessionRecord; cookie: string }> {
  const email = normalizeSocialEmail(input.profile.email);
  const providerUserId = input.profile.providerUserId.trim();
  if (!providerUserId) throw new Error('Social provider user id required');

  const existingAccount = await repository.getSocialAuthAccount(input.profile.provider, providerUserId);
  const existingUser = existingAccount
    ? await repository.getUserById(existingAccount.userId)
    : await repository.getUserByEmail(email);
  const user = existingUser
    ? await updateExistingSocialUser(repository, existingUser, input.createdAt)
    : await createSocialUser(repository, {
      email,
      name: input.profile.name,
      createdAt: input.createdAt,
    });

  await repository.saveSocialAuthAccount({
    id: existingAccount?.id ?? await repository.nextId('social_auth'),
    provider: input.profile.provider,
    providerUserId,
    userId: user.id,
    email,
    createdAt: existingAccount?.createdAt ?? input.createdAt,
    updatedAt: input.createdAt,
  });

  const { session, cookie } = await createAsyncSessionForUser(repository, {
    userId: user.id,
    createdAt: input.createdAt,
  });

  return { user, session, cookie };
}

export async function exchangeSocialAuthCode(
  provider: SocialAuthProvider,
  input: {
    code: string;
    requestUrl: string;
    state?: string;
    env?: SocialAuthRuntimeEnv;
  },
): Promise<SocialAuthProfile> {
  const config = getSocialAuthProviderConfig(provider, input.env);
  const redirectUri = createSocialAuthRedirectUri(input.requestUrl, provider);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code: input.code,
  });
  if (input.state) {
    body.set('state', input.state);
  }
  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error('Social token exchange failed');
  }

  const profileResponse = await fetch(config.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profilePayload = await profileResponse.json();
  if (!profileResponse.ok) throw new Error('Social profile request failed');

  return mapSocialAuthProfile(provider, profilePayload);
}

function createSocialAuthRedirectUri(requestUrl: string, provider: SocialAuthProvider): string {
  const url = new URL(requestUrl);
  return `${url.origin}/api/auth/social/${provider}/callback`;
}

function getCloudflareSocialAuthEnv(): SocialAuthRuntimeEnv {
  try {
    const context = getCloudflareContext();
    return pickSocialAuthRuntimeEnv(context.env as SocialAuthRuntimeEnv);
  } catch {
    return {};
  }
}

async function getCloudflareSocialAuthEnvAsync(): Promise<SocialAuthRuntimeEnv> {
  try {
    const context = await getCloudflareContext({ async: true });
    return pickSocialAuthRuntimeEnv(context.env as SocialAuthRuntimeEnv);
  } catch {
    return {};
  }
}

function pickSocialAuthRuntimeEnv(env: SocialAuthRuntimeEnv): SocialAuthRuntimeEnv {
  const picked: SocialAuthRuntimeEnv = {};
  for (const key of SOCIAL_AUTH_ENV_KEYS) {
    picked[key] = env[key];
  }
  return picked;
}

function mergeSocialAuthRuntimeEnv(
  baseEnv: SocialAuthRuntimeEnv,
  overrideEnv: SocialAuthRuntimeEnv,
): SocialAuthRuntimeEnv {
  const merged: SocialAuthRuntimeEnv = { ...baseEnv };
  for (const key of SOCIAL_AUTH_ENV_KEYS) {
    const value = overrideEnv[key]?.trim();
    if (value) {
      merged[key] = value;
    }
  }
  return merged;
}

function mapSocialAuthProfile(provider: SocialAuthProvider, payload: Record<string, unknown>): SocialAuthProfile {
  if (provider === 'google') {
    return {
      provider,
      providerUserId: readString(payload.sub),
      email: normalizeSocialEmail(readString(payload.email)),
      name: readString(payload.name) || readString(payload.email),
    };
  }
  if (provider === 'naver') {
    const response = readRecord(payload.response);
    return {
      provider,
      providerUserId: readString(response.id),
      email: normalizeSocialEmail(readString(response.email)),
      name: readString(response.name) || readString(response.nickname) || readString(response.email),
    };
  }

  const kakaoAccount = readRecord(payload.kakao_account);
  const profile = readRecord(kakaoAccount.profile);
  return {
    provider,
    providerUserId: readString(payload.id),
    email: normalizeSocialEmail(readString(kakaoAccount.email)),
    name: readString(profile.nickname) || readString(kakaoAccount.email),
  };
}

async function createSocialUser(
  repository: AsyncChartServiceRepository,
  input: { email: string; name: string; createdAt: string },
): Promise<ServiceUserRecord> {
  const user: ServiceUserRecord = {
    id: await repository.nextId('user'),
    email: input.email,
    name: input.name.trim() || input.email,
    role: USER_ROLES.member,
    accountStatus: USER_ACCOUNT_STATUSES.active,
    phoneNumber: null,
    profileImageDataUrl: null,
    referralCode: '',
    referredByUserId: null,
    createdAt: input.createdAt,
    passwordHash: null,
    emailVerifiedAt: input.createdAt,
  };
  user.referralCode = createUniqueRandomReferralCode((await repository.listUsers()).map((item) => item.referralCode));
  await repository.saveUser(user);
  return user;
}

async function updateExistingSocialUser(
  repository: AsyncChartServiceRepository,
  user: ServiceUserRecord,
  verifiedAt: string,
): Promise<ServiceUserRecord> {
  if (user.emailVerifiedAt) return user;
  const updatedUser = {
    ...user,
    emailVerifiedAt: verifiedAt,
  };
  await repository.saveUser(updatedUser);
  return updatedUser;
}

function normalizeSocialEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Social email required');
  }
  return email;
}

function requireSocialEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for social auth`);
  return value;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
