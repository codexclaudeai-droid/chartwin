import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('chart access API uses the awaitable persistence boundary and authenticated actor', async () => {
  const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
  const { session } = createSessionForUser(repository, {
    userId: 'user_subscriber',
    createdAt: '2026-05-24T00:00:00.000Z',
    ttlSeconds: 60 * 60 * 24 * 365,
  });
  const { GET } = await import('../app/api/chart/access/route.ts');

  const responsePromise = GET({
    headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${session.id}` }),
    nextUrl: new URL('http://localhost/api/chart/access?userId=user_member'),
  });
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.userId, 'user_subscriber');
  assert.equal(payload.fullChart, true);
  assert.equal(payload.paidSignals, true);
});

test('chart access API keeps mock preview query fallback for guests', async () => {
  const { GET } = await import('../app/api/chart/access/route.ts');

  const response = await GET({
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/chart/access?userId=user_trial'),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.userId, 'user_trial');
  assert.equal(payload.fullChart, true);
  assert.equal(payload.paidSignals, true);
});
