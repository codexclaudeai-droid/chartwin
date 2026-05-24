import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('subscription me API uses the awaitable persistence boundary and authenticated actor', async () => {
  const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
  const { session } = createSessionForUser(repository, {
    userId: 'user_subscriber',
    createdAt: '2026-05-24T00:00:00.000Z',
    ttlSeconds: 60 * 60 * 24 * 365,
  });
  const { GET } = await import('../app/api/subscription/me/route.ts');

  const responsePromise = GET({
    headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${session.id}` }),
    nextUrl: new URL('http://localhost/api/subscription/me?userId=user_member'),
  });
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.access.userId, 'user_subscriber');
  assert.equal(payload.access.fullChart, true);
  assert.equal(payload.subscription.id, 'sub_active');
});

test('subscription me API keeps mock preview query fallback for guests', async () => {
  const { GET } = await import('../app/api/subscription/me/route.ts');

  const response = await GET({
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/subscription/me?userId=user_trial'),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.access.userId, 'user_trial');
  assert.equal(payload.subscription.id, 'sub_trial');
});
