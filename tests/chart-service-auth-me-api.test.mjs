import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionForUser,
  createSessionCookie,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('auth me API returns a user summary for the session navigation', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { GET } = await import('../app/api/auth/me/route.ts');

  const responsePromise = GET(new Request('http://localhost/api/auth/me', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
  }));
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.authenticated, true);
  assert.equal(payload.actor.id, 'user_member');
  assert.equal(payload.user.email, 'member@example.com');
  assert.equal(payload.user.name, 'Member');
  assert.equal(payload.user.profileImageDataUrl, null);
  assert.equal(payload.user.role, 'member');
});

test('auth me API accepts signed session cookies when route memory is isolated', async () => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const cookie = createSessionCookie('external_session_admin', 60 * 60, {
    userId: 'admin_1',
    expiresAt,
  });
  const { GET } = await import('../app/api/auth/me/route.ts');

  const response = await GET(new Request('http://localhost/api/auth/me', {
    headers: { cookie },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.authenticated, true);
  assert.equal(payload.actor.id, 'admin_1');
  assert.equal(payload.user.email, 'admin@example.com');
});
