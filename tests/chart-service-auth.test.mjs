import test from 'node:test';
import assert from 'node:assert/strict';

test('mock auth creates an httpOnly session cookie for a known user', async () => {
  const {
    SESSION_COOKIE_NAME,
    createMockChartServiceRepository,
    parseSessionCookie,
    createSessionForUser,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-23T12:00:00.000Z',
  });

  assert.equal(result.session.userId, 'user_member');
  assert.match(result.cookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /SameSite=Lax/);
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
});

test('password hashes verify without storing the raw password', async () => {
  const {
    createPasswordHash,
    verifyPasswordHash,
  } = await import('../src/server/chart-service/index.ts');

  const hash = createPasswordHash('Demo1234!', { salt: 'test_salt' });
  const [, iterations] = hash.split('$');

  assert.notEqual(hash, 'Demo1234!');
  assert.match(hash, /^pbkdf2_sha256\$/);
  assert.equal(Number(iterations), 100_000);
  assert.equal(verifyPasswordHash('Demo1234!', hash), true);
  assert.equal(verifyPasswordHash('Wrong1234!', hash), false);
});

test('authenticates users by email and password before creating a session', async () => {
  const {
    authenticateUserWithPassword,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = authenticateUserWithPassword(repository, {
    email: 'MEMBER@example.com',
    password: 'Demo1234!',
    createdAt: '2026-05-23T12:00:00.000Z',
  });

  assert.equal(result.user.id, 'user_member');
  assert.equal(result.session.userId, 'user_member');
  assert.throws(() => authenticateUserWithPassword(repository, {
    email: 'member@example.com',
    password: 'Wrong1234!',
    createdAt: '2026-05-23T12:00:00.000Z',
  }), /Invalid email or password/);
});

test('login API rejects userId-only mock login and accepts email password credentials', async () => {
  const {
    resetChartServiceRateLimits,
    SESSION_COOKIE_NAME,
  } = await import('../src/server/chart-service/index.ts');
  const { POST } = await import('../app/api/auth/login/route.ts');

  resetChartServiceRateLimits();
  const userIdOnly = await POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({ userId: 'admin_1' }),
  }));
  const userIdPayload = await userIdOnly.json();
  assert.equal(userIdOnly.status, 401);
  assert.equal(userIdPayload.ok, false);

  const response = await POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Demo1234!' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.user.email, 'admin@example.com');
  assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`${SESSION_COOKIE_NAME}=`));
});

test('session cookies can be marked secure for production transport', async () => {
  const { createClearSessionCookie, createSessionCookie } = await import('../src/server/chart-service/index.ts');

  assert.match(createSessionCookie('session_1', 60, { secure: true }), /Secure/);
  assert.match(createClearSessionCookie({ secure: true }), /Secure/);
  assert.doesNotMatch(createSessionCookie('session_1', 60, { secure: false }), /Secure/);
  assert.doesNotMatch(createClearSessionCookie({ secure: false }), /Secure/);
});

test('session cookies default to secure transport in production', async () => {
  const { shouldUseSecureSessionCookie } = await import('../src/server/chart-service/index.ts');

  assert.equal(shouldUseSecureSessionCookie({ nodeEnv: 'production' }), true);
  assert.equal(shouldUseSecureSessionCookie({ nodeEnv: 'development' }), false);
});

test('mock auth resolves an actor from a valid session id', async () => {
  const {
    createMockChartServiceRepository,
    createSessionForUser,
    getActorFromSession,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: '2026-05-23T12:00:00.000Z',
  });
  const actor = getActorFromSession(repository, session.id, '2026-05-23T12:05:00.000Z');

  assert.deepEqual(actor, { id: 'admin_1', role: 'admin' });
});

test('signed session cookies resolve across isolated memory repositories', async () => {
  const {
    createMockChartServiceRepository,
    createSessionForUser,
    getActorFromSession,
    parseSessionCookieClaims,
  } = await import('../src/server/chart-service/index.ts');

  const loginRepository = createMockChartServiceRepository();
  const { cookie, session } = createSessionForUser(loginRepository, {
    userId: 'admin_1',
    createdAt: '2026-05-23T12:00:00.000Z',
  });
  const isolatedRouteRepository = createMockChartServiceRepository();
  const claims = parseSessionCookieClaims(cookie);

  assert.equal(claims?.sessionId, session.id);
  assert.equal(claims?.userId, 'admin_1');
  assert.equal(claims?.signed, true);
  assert.deepEqual(
    getActorFromSession(isolatedRouteRepository, claims, '2026-05-23T12:05:00.000Z'),
    { id: 'admin_1', role: 'admin' },
  );
});

test('tampered signed session cookies do not fall back to unsigned identity claims', async () => {
  const {
    createMockChartServiceRepository,
    createSessionForUser,
    getActorFromSession,
    parseSessionCookieClaims,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const { cookie } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: '2026-05-23T12:00:00.000Z',
  });
  const [nameValue, ...attributes] = cookie.split('; ');
  const tamperedNameValue = `${nameValue.slice(0, -1)}${nameValue.endsWith('x') ? 'y' : 'x'}`;
  const tamperedCookie = [tamperedNameValue, ...attributes].join('; ');
  const claims = parseSessionCookieClaims(tamperedCookie);

  assert.equal(claims?.signed, false);
  assert.equal(claims?.userId, undefined);
  assert.equal(claims?.sessionId, parseSessionCookieClaims(cookie)?.sessionId);
  assert.throws(() => getActorFromSession(
    createMockChartServiceRepository(),
    claims,
    '2026-05-23T12:05:00.000Z',
  ), /Session not found/);
});

test('mock auth rejects expired sessions', async () => {
  const {
    createMockChartServiceRepository,
    createSessionForUser,
    getActorFromSession,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-23T12:00:00.000Z',
    ttlSeconds: 60,
  });

  assert.throws(() => getActorFromSession(
    repository,
    session.id,
    '2026-05-23T12:02:00.000Z',
  ), /Session expired/);
});

test('mock auth parses session id from a cookie header', async () => {
  const {
    SESSION_COOKIE_NAME,
    parseSessionCookie,
  } = await import('../src/server/chart-service/index.ts');

  const cookie = `theme=light; ${SESSION_COOKIE_NAME}=session_123; other=value`;

  assert.equal(parseSessionCookie(cookie), 'session_123');
  assert.equal(parseSessionCookie('theme=light'), null);
});

test('mock auth creates a clearing cookie for logout', async () => {
  const { SESSION_COOKIE_NAME, createClearSessionCookie } = await import('../src/server/chart-service/index.ts');

  const cookie = createClearSessionCookie();

  assert.match(cookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});

test('request admin guard requires an admin session cookie', async () => {
  const {
    SESSION_COOKIE_NAME,
    createMockChartServiceRepository,
    createSessionForUser,
    requireAdminFromRequest,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const memberSession = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-23T12:00:00.000Z',
  }).session;
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: '2026-05-23T12:00:00.000Z',
  }).session;

  const requestWithCookie = (sessionId) => ({
    headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${sessionId}` }),
  });

  assert.throws(() => requireAdminFromRequest(
    repository,
    { headers: new Headers() },
    '2026-05-23T12:01:00.000Z',
  ), /Session required/);
  assert.throws(() => requireAdminFromRequest(
    repository,
    requestWithCookie(memberSession.id),
    '2026-05-23T12:01:00.000Z',
  ), /Admin role required/);
  assert.deepEqual(
    requireAdminFromRequest(repository, requestWithCookie(adminSession.id), '2026-05-23T12:01:00.000Z'),
    { id: 'admin_1', role: 'admin' },
  );
});
