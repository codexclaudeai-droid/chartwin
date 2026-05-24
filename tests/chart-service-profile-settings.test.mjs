import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAuthenticatedUserProfile,
} from '../src/server/chart-service/index.ts';
import { createProfileImagePolicyPayload } from '../app/profile/profile-image-policy.ts';

test('profile settings update only the authenticated users display name', () => {
  const repository = createMockChartServiceRepository();

  const user = updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: '  Blue Trader  ',
  });

  assert.equal(user.name, 'Blue Trader');
  assert.equal(repository.getUserById('user_member')?.name, 'Blue Trader');
  assert.equal(repository.getUserById('user_subscriber')?.name, 'Subscriber');
});

test('profile settings reject blank display names', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: '   ',
  }), /Profile name required/);
  assert.equal(repository.getUserById('user_member')?.name, 'Member');
});

test('profile image policy payload uses the selected browser file metadata', () => {
  assert.deepEqual(createProfileImagePolicyPayload({
    name: 'avatar.webp',
    type: 'image/webp',
    size: 120_000,
  }), {
    filename: 'avatar.webp',
    mimeType: 'image/webp',
    sizeBytes: 120_000,
  });
});

test('profile patch API updates the signed-in users dashboard name', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { PATCH } = await import('../app/api/profile/route.ts');

  const responsePromise = PATCH(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Updated Member' }),
  }));
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dashboard.user.name, 'Updated Member');
  assert.equal(repository.getUserById('user_member')?.name, 'Updated Member');
});

test('profile API mutation path is routed through the async persistence boundary', () => {
  const routeSource = fs.readFileSync(new URL('../app/api/profile/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /getAsyncChartServicePersistence/);
  assert.match(routeSource, /runMutation/);
});

test('profile image policy API validates upload metadata for signed-in users', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { POST } = await import('../app/api/profile/image-policy/route.ts');

  const allowed = await POST(new Request('http://localhost/api/profile/image-policy', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ filename: 'avatar.webp', mimeType: 'image/webp', sizeBytes: 120_000 }),
  }));
  const denied = await POST(new Request('http://localhost/api/profile/image-policy', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ filename: 'avatar.svg', mimeType: 'image/svg+xml', sizeBytes: 12_000 }),
  }));
  const allowedPayload = await allowed.json();
  const deniedPayload = await denied.json();

  assert.equal(allowed.status, 200);
  assert.equal(allowedPayload.policy.ok, true);
  assert.equal(denied.status, 400);
  assert.equal(deniedPayload.policy.reason, 'unsupported_type');
});
