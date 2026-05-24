import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  createMockChartServiceState,
} from '../src/server/chart-service/index.ts';

const NOW = '2026-05-24T12:00:00.000Z';

test('password reset requests store only a token hash and keep unknown emails indistinguishable', async () => {
  const {
    createPasswordResetTokenHash,
    requestAsyncPasswordReset,
  } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  const existing = await requestAsyncPasswordReset(repository, {
    email: ' member@example.com ',
    requestedAt: NOW,
    token: 'plain-reset-token',
  });
  const unknown = await requestAsyncPasswordReset(repository, {
    email: 'missing@example.com',
    requestedAt: NOW,
    token: 'unknown-token',
  });
  const resetRecord = await repository.getPasswordResetTokenByTokenHash(
    createPasswordResetTokenHash('plain-reset-token'),
  );

  assert.equal(existing.accepted, true);
  assert.equal(existing.created, true);
  assert.equal(existing.token, 'plain-reset-token');
  assert.equal(unknown.accepted, true);
  assert.equal(unknown.created, false);
  assert.equal(unknown.token, null);
  assert.equal(resetRecord?.userId, 'user_member');
  assert.notEqual(resetRecord?.tokenHash, 'plain-reset-token');
  assert.equal(resetRecord?.usedAt, null);
});

test('password reset consumes a valid token, changes the password, and clears user sessions', async () => {
  const {
    createSessionForUser,
    requestAsyncPasswordReset,
    resetAsyncPasswordWithToken,
    verifyPasswordHash,
  } = await import('../src/server/chart-service/index.ts');
  const syncRepository = createMockChartServiceRepository(createMockChartServiceState());
  const repository = createAsyncChartServiceRepository(syncRepository);
  const session = createSessionForUser(syncRepository, {
    userId: 'user_member',
    createdAt: NOW,
  }).session;
  await requestAsyncPasswordReset(repository, {
    email: 'member@example.com',
    requestedAt: NOW,
    token: 'valid-reset-token',
  });

  const result = await resetAsyncPasswordWithToken(repository, {
    token: 'valid-reset-token',
    password: 'NewDemo1234!',
    resetAt: '2026-05-24T12:05:00.000Z',
  });
  const user = await repository.getUserById('user_member');

  assert.equal(result.user.id, 'user_member');
  assert.equal(verifyPasswordHash('NewDemo1234!', user?.passwordHash), true);
  assert.equal(verifyPasswordHash('Demo1234!', user?.passwordHash), false);
  assert.equal((await repository.listSessionsByUserId('user_member')).length, 0);
  assert.equal(await repository.getSessionById(session.id), null);
});

test('password reset rejects expired or already used tokens', async () => {
  const {
    requestAsyncPasswordReset,
    resetAsyncPasswordWithToken,
  } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  await requestAsyncPasswordReset(repository, {
    email: 'member@example.com',
    requestedAt: NOW,
    token: 'expired-token',
    ttlSeconds: 1,
  });
  await assert.rejects(
    resetAsyncPasswordWithToken(repository, {
      token: 'expired-token',
      password: 'NewDemo1234!',
      resetAt: '2026-05-24T12:01:00.000Z',
    }),
    /expired/,
  );

  await requestAsyncPasswordReset(repository, {
    email: 'member@example.com',
    requestedAt: NOW,
    token: 'single-use-token',
  });
  await resetAsyncPasswordWithToken(repository, {
    token: 'single-use-token',
    password: 'Another1234!',
    resetAt: '2026-05-24T12:01:00.000Z',
  });
  await assert.rejects(
    resetAsyncPasswordWithToken(repository, {
      token: 'single-use-token',
      password: 'Again1234!',
      resetAt: '2026-05-24T12:02:00.000Z',
    }),
    /already used/,
  );
});

test('password reset API routes use guarded async mutations and do not leak production account existence', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const requestRoute = await import('../app/api/auth/password-reset/request/route.ts');
  const confirmRoute = await import('../app/api/auth/password-reset/confirm/route.ts');

  try {
    const existingResponse = await requestRoute.POST(new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.com' }),
    }));
    const unknownResponse = await requestRoute.POST(new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com' }),
    }));
    const existingPayload = await existingResponse.json();
    const unknownPayload = await unknownResponse.json();

    assert.equal(existingResponse.status, 200);
    assert.equal(unknownResponse.status, 200);
    assert.deepEqual(existingPayload, unknownPayload);
    assert.equal(existingPayload.resetTokenPreview, undefined);
    assert.equal(typeof confirmRoute.POST, 'function');
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

