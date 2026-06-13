import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  completeAsyncSocialAuth,
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  createSocialAuthAuthorizationUrl,
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

test('social auth completion creates a verified member account and session', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const result = await completeAsyncSocialAuth(repository, {
    profile: {
      provider: 'kakao',
      providerUserId: 'kakao-123',
      email: 'Social@Example.com',
      name: 'Social User',
    },
    createdAt: '2026-06-01T10:00:00.000Z',
  });
  const user = syncRepository.getUserByEmail('social@example.com');
  const linkedAccounts = syncRepository.listSocialAuthAccountsByUserId(result.user.id);

  assert.equal(result.user.email, 'social@example.com');
  assert.equal(result.user.role, 'member');
  assert.equal(result.user.passwordHash, null);
  assert.equal(result.user.emailVerifiedAt, '2026-06-01T10:00:00.000Z');
  assert.equal(user?.id, result.user.id);
  assert.equal(linkedAccounts.length, 1);
  assert.equal(linkedAccounts[0].provider, 'kakao');
  assert.equal(linkedAccounts[0].providerUserId, 'kakao-123');
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
});

test('signup and login panels wire Google auth while keeping other providers preparation-only', () => {
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
  assert.match(loginSource, /login-social-auth-actions/);
  assert.match(loginSource, /social-auth-icon-google/);
  assert.match(loginSource, /google-logo-svg/);
  assert.match(loginSource, /href="\/api\/auth\/social\/google\/start"/);
  assert.match(loginSource, /social-auth-icon-naver/);
  assert.match(loginSource, /naver-logo-svg/);
  assert.match(loginSource, /social-auth-icon-kakao/);
  assert.match(loginSource, /kakao-logo-svg/);
  assert.match(loginSource, /간편로그인은 서비스 준비중입니다/);
  assert.match(startRouteSource, /createSocialAuthAuthorizationUrl/);
  assert.match(startRouteSource, /createSocialAuthStateCookie/);
  assert.match(callbackRouteSource, /exchangeSocialAuthCode/);
  assert.match(callbackRouteSource, /completeAsyncSocialAuth/);
  assert.match(callbackRouteSource, /new URL\('\/main', request\.url\)/);
});
