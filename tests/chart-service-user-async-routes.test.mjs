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
  '../app/api/notifications/read-all/route.ts',
  '../app/api/notifications/[id]/read/route.ts',
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
  ]) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /getAsyncChartServicePersistence/, `${routePath} should create async persistence`);
    assert.match(source, /runRead/, `${routePath} should execute reads inside a read scope`);
  }
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
    }),
  }));
  const signupPayload = await signupResponse.json();

  assert.equal(loginResponse.status, 200);
  assert.equal(loginPayload.user.passwordHash, undefined);
  assert.equal(signupResponse.status, 200);
  assert.equal(signupPayload.user.passwordHash, undefined);
});
