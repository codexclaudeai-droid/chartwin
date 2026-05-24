import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('profile API returns the authenticated user dashboard summary', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { GET } = await import('../app/api/profile/route.ts');

  const responsePromise = GET(new Request('http://localhost/api/profile', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
  }));
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dashboard.user.email, 'member@example.com');
  assert.equal(payload.dashboard.user.passwordHash, undefined);
  assert.equal(payload.dashboard.subscription.status, 'payment_pending');
  assert.equal(payload.dashboard.payments.length, 1);
  assert.equal(typeof payload.dashboard.notifications.unreadCount, 'number');
  assert.equal(typeof payload.dashboard.support.visibleThreadCount, 'number');
});
