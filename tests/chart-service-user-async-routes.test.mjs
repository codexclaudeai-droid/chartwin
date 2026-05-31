import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const userMutationRoutes = [
  '../app/api/auth/login/route.ts',
  '../app/api/auth/signup/route.ts',
  '../app/api/auth/logout/route.ts',
  '../app/api/payments/request/route.ts',
  '../app/api/profile/image-policy/route.ts',
  '../app/api/subscription/cancel-request/route.ts',
  '../app/api/subscription/refund-request/route.ts',
  '../app/api/trial/request/route.ts',
  '../app/api/notifications/read-all/route.ts',
  '../app/api/notifications/[id]/read/route.ts',
  '../app/api/notifications/[id]/archive/route.ts',
  '../app/api/support/threads/route.ts',
];

test('user mutation routes use the async persistence boundary', () => {
  for (const routePath of userMutationRoutes) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /getAsyncChartServicePersistence/, `${routePath} should create async persistence`);
    assert.match(source, /runMutation/, `${routePath} should execute changes inside a mutation scope`);
    assert.doesNotMatch(source, /getChartServiceRepository\(/, `${routePath} should not use the sync singleton directly`);
    assert.doesNotMatch(source, /getActorFromRequest\(/, `${routePath} should not use the sync request actor helper directly`);
  }
});

test('user read routes use the async persistence boundary', () => {
  for (const routePath of [
    '../app/api/notifications/route.ts',
    '../app/api/support/threads/route.ts',
    '../app/api/auth/email-check/route.ts',
    '../app/api/auth/referral-check/route.ts',
  ]) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /getAsyncChartServicePersistence/, `${routePath} should create async persistence`);
    assert.match(source, /runRead/, `${routePath} should execute reads inside a read scope`);
  }
});

test('notifications API supports a summary-only badge request path', () => {
  const routeSource = readFileSync(new URL('../app/api/notifications/route.ts', import.meta.url), 'utf8');
  const navSource = readFileSync(new URL('../app/notification-nav-link.tsx', import.meta.url), 'utf8');

  assert.match(routeSource, /summaryOnly/);
  assert.match(routeSource, /request\.nextUrl\.searchParams\.get\('summary'\) === '1'/);
  assert.match(routeSource, /getAsyncNotificationSummaryForUser/);
  assert.match(navSource, /getNotificationSummary/);
  assert.doesNotMatch(navSource, /fetch\('\/api\/notifications'/);
});

test('auth responses do not expose password hashes', async () => {
  const { resetChartServiceRateLimits } = await import('../src/server/chart-service/index.ts');
  const loginRoute = await import('../app/api/auth/login/route.ts');
  const signupRoute = await import('../app/api/auth/signup/route.ts');

  resetChartServiceRateLimits();
  const loginResponse = await loginRoute.POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Demo1234!' }),
  }));
  const loginPayload = await loginResponse.json();

  resetChartServiceRateLimits();
  const signupResponse = await signupRoute.POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: `new-user-${Date.now()}@example.com`,
      name: 'New User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaaa',
      phoneNumber: '010-1212-3434',
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  }));
  const signupPayload = await signupResponse.json();

  assert.equal(loginResponse.status, 200);
  assert.equal(loginPayload.user.passwordHash, undefined);
  assert.equal(signupResponse.status, 200);
  assert.equal(signupPayload.user.passwordHash, undefined);
});

test('payment request route rejects bank transfers without a depositor name', async () => {
  const { resetChartServiceRateLimits } = await import('../src/server/chart-service/index.ts');
  const loginRoute = await import('../app/api/auth/login/route.ts');
  const paymentRoute = await import('../app/api/payments/request/route.ts');

  resetChartServiceRateLimits();
  const loginResponse = await loginRoute.POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'member@example.com', password: 'Demo1234!' }),
  }));

  const paymentResponse = await paymentRoute.POST(new Request('http://localhost/api/payments/request', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
      cookie: loginResponse.headers.get('set-cookie') ?? '',
    },
    body: JSON.stringify({
      planId: 'plan_monthly',
      method: 'bank_transfer',
      depositorName: '   ',
      exchangeRate: 1360,
    }),
  }));
  const paymentPayload = await paymentResponse.json();

  assert.equal(paymentResponse.status, 400);
  assert.equal(paymentPayload.ok, false);
  assert.match(paymentPayload.message, /Bank transfer depositor name required/);
});

test('payment request route blocks duplicate subscription plan requests', async () => {
  const { resetChartServiceRateLimits } = await import('../src/server/chart-service/index.ts');
  const loginRoute = await import('../app/api/auth/login/route.ts');
  const paymentRoute = await import('../app/api/payments/request/route.ts');

  resetChartServiceRateLimits();
  const loginResponse = await loginRoute.POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'member@example.com', password: 'Demo1234!' }),
  }));

  const paymentResponse = await paymentRoute.POST(new Request('http://localhost/api/payments/request', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
      cookie: loginResponse.headers.get('set-cookie') ?? '',
    },
    body: JSON.stringify({
      planId: 'plan_monthly',
      method: 'bank_transfer',
      depositorName: 'Member',
      exchangeRate: 1360,
    }),
  }));
  const paymentPayload = await paymentResponse.json();

  assert.equal(paymentResponse.status, 400);
  assert.equal(paymentPayload.ok, false);
  assert.match(paymentPayload.message, /이미 구독 신청이 접수되어 처리 중입니다/);
});
