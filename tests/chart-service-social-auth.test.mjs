import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  completeAsyncSocialAuth,
  createAsyncChartServiceRepository,
  createCanonicalSocialAuthStartUrl,
  createMockChartServiceRepository,
  getSocialAuthRuntimeEnv,
  getSocialAuthRuntimeEnvAsync,
  createSocialAuthAuthorizationUrl,
  exchangeSocialAuthCode,
  getSocialAuthProviderConfig,
  parseSessionCookie,
  SOCIAL_AUTH_PROVIDERS,
} from '../src/server/chart-service/index.ts';

test('social auth provider config uses provider-specific OAuth endpoints', () => {
  const env = {
    CHART_SERVICE_GOOGLE_CLIENT_ID: 'google-client',
    CHART_SERVICE_GOOGLE_CLIENT_SECRET: 'google-secret',
    CHART_SERVICE_NAVER_CLIENT_ID: 'naver-client',
    CHART_SERVICE_NAVER_CLIENT_SECRET: 'naver-secret',
    CHART_SERVICE_KAKAO_CLIENT_ID: 'kakao-client',
    CHART_SERVICE_KAKAO_CLIENT_SECRET: 'kakao-secret',
  };

  assert.deepEqual(SOCIAL_AUTH_PROVIDERS, ['google', 'naver', 'kakao']);
  assert.equal(getSocialAuthProviderConfig('google', env).authorizationEndpoint, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(getSocialAuthProviderConfig('naver', env).authorizationEndpoint, 'https://nid.naver.com/oauth2.0/authorize');
  assert.equal(getSocialAuthProviderConfig('kakao', env).authorizationEndpoint, 'https://kauth.kakao.com/oauth/authorize');

  const googleUrl = new URL(createSocialAuthAuthorizationUrl({
    provider: 'google',
    requestUrl: 'http://localhost:3000/api/auth/social/google/start',
    state: 'state_1',
    env,
  }));
  assert.equal(googleUrl.searchParams.get('client_id'), 'google-client');
  assert.equal(googleUrl.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/social/google/callback');
  assert.equal(googleUrl.searchParams.get('state'), 'state_1');
});

test('social auth redirects use the configured public base URL across domains', async () => {
  const env = {
    CHART_SERVICE_BASE_URL: 'https://tradingcore.co',
    CHART_SERVICE_GOOGLE_CLIENT_ID: 'google-client',
    CHART_SERVICE_GOOGLE_CLIENT_SECRET: 'google-secret',
    CHART_SERVICE_NAVER_CLIENT_ID: 'naver-client',
    CHART_SERVICE_NAVER_CLIENT_SECRET: 'naver-secret',
  };

  const googleUrl = new URL(createSocialAuthAuthorizationUrl({
    provider: 'google',
    requestUrl: 'https://www.tradingcore.co/api/auth/social/google/start',
    state: 'state_google',
    env,
  }));
  const naverUrl = new URL(createSocialAuthAuthorizationUrl({
    provider: 'naver',
    requestUrl: 'https://chartwin.thankpxp.workers.dev/api/auth/social/naver/start',
    state: 'state_naver',
    env,
  }));
  const fetchRequests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchRequests.push({
      url: String(url),
      body: String(options?.body ?? ''),
    });
    if (String(url).includes('/token')) {
      return Response.json({ access_token: 'google-access-token' });
    }
    return Response.json({
      sub: 'google-123',
      email: 'Google@Example.com',
      name: 'Google User',
    });
  };

  try {
    await exchangeSocialAuthCode('google', {
      code: 'code_1',
      requestUrl: 'https://www.tradingcore.co/api/auth/social/google/callback',
      env,
    });

    assert.equal(googleUrl.searchParams.get('redirect_uri'), 'https://tradingcore.co/api/auth/social/google/callback');
    assert.equal(naverUrl.searchParams.get('redirect_uri'), 'https://tradingcore.co/api/auth/social/naver/callback');
    assert.match(fetchRequests[0].body, /redirect_uri=https%3A%2F%2Ftradingcore\.co%2Fapi%2Fauth%2Fsocial%2Fgoogle%2Fcallback/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('social auth start URL canonicalizes before issuing state cookies', () => {
  const env = { CHART_SERVICE_BASE_URL: 'https://tradingcore.co' };

  assert.equal(
    createCanonicalSocialAuthStartUrl({
      provider: 'naver',
      requestUrl: 'https://www.tradingcore.co/api/auth/social/naver/start',
      env,
    }),
    'https://tradingcore.co/api/auth/social/naver/start',
  );
  assert.equal(
    createCanonicalSocialAuthStartUrl({
      provider: 'google',
      requestUrl: 'https://chartwin.thankpxp.workers.dev/api/auth/social/google/start',
      env,
    }),
    'https://tradingcore.co/api/auth/social/google/start',
  );
  assert.equal(
    createCanonicalSocialAuthStartUrl({
      provider: 'naver',
      requestUrl: 'https://tradingcore.co/api/auth/social/naver/start',
      env,
    }),
    null,
  );
});

test('Naver auth request omits scope and sends callback state during token exchange', async () => {
  const env = {
    CHART_SERVICE_NAVER_CLIENT_ID: 'naver-client',
    CHART_SERVICE_NAVER_CLIENT_SECRET: 'naver-secret',
  };
  const authorizationUrl = new URL(createSocialAuthAuthorizationUrl({
    provider: 'naver',
    requestUrl: 'https://tradingcore.co/api/auth/social/naver/start',
    state: 'state_1',
    env,
  }));
  const fetchRequests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchRequests.push({
      url: String(url),
      body: String(options?.body ?? ''),
    });
    if (String(url).includes('/oauth2.0/token')) {
      return Response.json({ access_token: 'naver-access-token' });
    }
    return Response.json({
      response: {
        id: 'naver-123',
        email: 'Naver@Example.com',
        name: 'Naver User',
        mobile: '010-1234-5678',
      },
    });
  };

  try {
    const profile = await exchangeSocialAuthCode('naver', {
      code: 'code_1',
      requestUrl: 'https://tradingcore.co/api/auth/social/naver/callback',
      state: 'state_1',
      env,
    });

    assert.equal(authorizationUrl.searchParams.has('scope'), false);
    assert.match(fetchRequests[0].body, /state=state_1/);
    assert.equal(profile.provider, 'naver');
    assert.equal(profile.providerUserId, 'naver-123');
    assert.equal(profile.email, 'naver@example.com');
    assert.equal(profile.phoneNumber, '010-1234-5678');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('social auth completion creates a verified member account with provider phone and session', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const result = await completeAsyncSocialAuth(repository, {
    profile: {
      provider: 'kakao',
      providerUserId: 'kakao-123',
      email: 'Social@Example.com',
      name: 'Social User',
      phoneNumber: '010-9876-5432',
    },
    createdAt: '2026-06-01T10:00:00.000Z',
  });
  const user = syncRepository.getUserByEmail('social@example.com');
  const linkedAccounts = syncRepository.listSocialAuthAccountsByUserId(result.user.id);

  assert.equal(result.user.email, 'social@example.com');
  assert.equal(result.user.role, 'member');
  assert.equal(result.user.phoneNumber, '010-9876-5432');
  assert.equal(result.user.passwordHash, null);
  assert.equal(result.user.emailVerifiedAt, '2026-06-01T10:00:00.000Z');
  assert.equal(user?.id, result.user.id);
  assert.equal(linkedAccounts.length, 1);
  assert.equal(linkedAccounts[0].provider, 'kakao');
  assert.equal(linkedAccounts[0].providerUserId, 'kakao-123');
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
});

test('social auth completion reactivates a withdrawn linked member account', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const withdrawn = syncRepository.getUserByEmail('member@example.com');
  assert.ok(withdrawn);
  syncRepository.saveUser({
    ...withdrawn,
    accountStatus: 'suspended',
    phoneNumber: null,
    passwordHash: null,
  });
  syncRepository.saveSocialAuthAccount({
    id: 'social_auth_existing',
    provider: 'google',
    providerUserId: 'google-member',
    userId: withdrawn.id,
    email: withdrawn.email,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  });

  const result = await completeAsyncSocialAuth(repository, {
    profile: {
      provider: 'google',
      providerUserId: 'google-member',
      email: 'member@example.com',
      name: 'Returned Social Member',
      phoneNumber: '010-1111-2222',
    },
    createdAt: '2026-06-14T10:00:00.000Z',
  });
  const saved = syncRepository.getUserById(withdrawn.id);

  assert.equal(result.user.id, withdrawn.id);
  assert.equal(result.user.accountStatus, 'active');
  assert.equal(result.user.phoneNumber, '010-1111-2222');
  assert.equal(saved?.accountStatus, 'active');
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
});

test('social auth runtime env keeps OAuth secret values when Cloudflare bindings are partial', async () => {
  const env = getSocialAuthRuntimeEnv({
    CHART_SERVICE_GOOGLE_CLIENT_ID: 'google-client',
    CHART_SERVICE_GOOGLE_CLIENT_SECRET: 'google-secret',
    CHART_SERVICE_NAVER_CLIENT_ID: 'naver-client',
    CHART_SERVICE_NAVER_CLIENT_SECRET: 'naver-secret',
  });

  assert.equal(env.CHART_SERVICE_GOOGLE_CLIENT_ID, 'google-client');
  assert.equal(env.CHART_SERVICE_GOOGLE_CLIENT_SECRET, 'google-secret');
  assert.equal(env.CHART_SERVICE_NAVER_CLIENT_ID, 'naver-client');
  assert.equal(env.CHART_SERVICE_NAVER_CLIENT_SECRET, 'naver-secret');

  const asyncEnv = await getSocialAuthRuntimeEnvAsync(env);
  assert.equal(asyncEnv.CHART_SERVICE_GOOGLE_CLIENT_ID, 'google-client');
  assert.equal(asyncEnv.CHART_SERVICE_GOOGLE_CLIENT_SECRET, 'google-secret');
  assert.equal(asyncEnv.CHART_SERVICE_NAVER_CLIENT_ID, 'naver-client');
  assert.equal(asyncEnv.CHART_SERVICE_NAVER_CLIENT_SECRET, 'naver-secret');
});

test('signup and login panels wire Google and Naver auth while keeping Kakao preparation-only', () => {
  const signupSource = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const loginSource = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const startRouteSource = readFileSync(new URL('../app/api/auth/social/[provider]/start/route.ts', import.meta.url), 'utf8');
  const callbackRouteSource = readFileSync(new URL('../app/api/auth/social/[provider]/callback/route.ts', import.meta.url), 'utf8');

  assert.match(signupSource, /signup-social-auth-actions/);
  assert.match(signupSource, /social-auth-button-google/);
  assert.match(signupSource, /social-auth-button-naver/);
  assert.match(signupSource, /social-auth-button-kakao/);
  assert.match(signupSource, /renderGoogleLogo/);
  assert.match(signupSource, /renderNaverLogo/);
  assert.match(signupSource, /renderKakaoLogo/);
  assert.match(signupSource, /google-logo-svg/);
  assert.match(signupSource, /naver-logo-svg/);
  assert.match(signupSource, /kakao-logo-svg/);
  assert.match(signupSource, /Google로 가입/);
  assert.match(signupSource, /네이버로 가입/);
  assert.match(signupSource, /카카오로 가입/);
  assert.match(signupSource, /간편가입은 서비스 준비중입니다/);
  assert.match(signupSource, /href="\/api\/auth\/social\/google\/start"/);
  assert.match(signupSource, /href="\/api\/auth\/social\/naver\/start"/);
  assert.match(loginSource, /login-social-auth-actions/);
  assert.match(loginSource, /social-auth-icon-google/);
  assert.match(loginSource, /google-logo-svg/);
  assert.match(loginSource, /href="\/api\/auth\/social\/google\/start"/);
  assert.match(loginSource, /social-auth-icon-naver/);
  assert.match(loginSource, /naver-logo-svg/);
  assert.match(loginSource, /href="\/api\/auth\/social\/naver\/start"/);
  assert.match(loginSource, /social-auth-icon-kakao/);
  assert.match(loginSource, /kakao-logo-svg/);
  assert.match(loginSource, /간편로그인은 서비스 준비중입니다/);
  assert.match(startRouteSource, /createSocialAuthAuthorizationUrl/);
  assert.match(startRouteSource, /createCanonicalSocialAuthStartUrl/);
  assert.match(startRouteSource, /createSocialAuthStateCookie/);
  assert.match(startRouteSource, /getSocialAuthRuntimeEnvAsync/);
  assert.match(callbackRouteSource, /exchangeSocialAuthCode/);
  assert.match(callbackRouteSource, /completeAsyncSocialAuth/);
  assert.match(callbackRouteSource, /getSocialAuthRuntimeEnvAsync/);
  assert.match(callbackRouteSource, /new URL\('\/main', request\.url\)/);
});
