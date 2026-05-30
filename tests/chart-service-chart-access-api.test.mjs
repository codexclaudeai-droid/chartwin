import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('chart access API rejects guest preview fallback requests', async () => {
  const { GET } = await import('../app/api/chart/access/route.ts');

  const response = await GET({
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/chart/access?userId=user_trial'),
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /Session required/);
});

test('chart access API blocks authenticated members before subscription approval', async () => {
  const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-24T00:00:00.000Z',
    ttlSeconds: 60 * 60 * 24 * 365,
  });
  const { GET } = await import('../app/api/chart/access/route.ts');

  const response = await GET({
    headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${session.id}` }),
    nextUrl: new URL('http://localhost/api/chart/access'),
  });
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.equal(payload.access.userId, 'user_member');
  assert.equal(payload.access.fullChart, false);
  assert.match(payload.message, /구독 승인 후 이용 가능/);
});

test('chart runtime waits for access approval before importing the chart engine', () => {
  const source = readFileSync(new URL('../app/chart/chart-runtime.tsx', import.meta.url), 'utf8');

  assert.match(source, /fetch\('\/api\/chart\/access'/);
  assert.match(source, /payload\.fullChart !== true/);
  assert.match(source, /void import\('\.\.\/\.\.\/src\/main\.ts'\)/);
});

test('chart page performs a server-side session and subscription gate', () => {
  const source = readFileSync(new URL('../app/chart/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /export const dynamic = 'force-dynamic'/);
  assert.match(source, /headers\(\)/);
  assert.match(source, /getActorFromAsyncRequest/);
  assert.match(source, /getAsyncChartAccessSnapshot/);
  assert.match(source, /redirect\('\/login\?redirect=\/chart'\)/);
  assert.match(source, /access\.fullChart/);
});
