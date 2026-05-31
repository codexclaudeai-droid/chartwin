import assert from 'node:assert/strict';
import test from 'node:test';

test('auth session client dedupes concurrent session checks and supports priming', async () => {
  const {
    clearAuthSessionCache,
    getAuthSession,
    primeAuthSession,
  } = await import('../app/auth-session-client.ts');
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  try {
    clearAuthSessionCache();
    globalThis.fetch = async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({
        authenticated: true,
        user: {
          id: 'user_member',
          email: 'member@example.com',
          name: 'Member',
          profileImageDataUrl: null,
          role: 'member',
          accountStatus: 'active',
        },
      }), { status: 200 });
    };

    const [first, second, third] = await Promise.all([
      getAuthSession(),
      getAuthSession(),
      getAuthSession(),
    ]);

    assert.equal(fetchCount, 1);
    assert.equal(first.user?.email, 'member@example.com');
    assert.equal(second.user?.email, 'member@example.com');
    assert.equal(third.user?.email, 'member@example.com');

    const cached = await getAuthSession();
    assert.equal(fetchCount, 1);
    assert.equal(cached.authenticated, true);

    primeAuthSession({
      authenticated: true,
      user: {
        id: 'admin_1',
        email: 'admin@example.com',
        name: 'Admin',
        profileImageDataUrl: null,
        role: 'admin',
        accountStatus: 'active',
      },
    });
    const primed = await getAuthSession();
    assert.equal(fetchCount, 1);
    assert.equal(primed.user?.email, 'admin@example.com');

    clearAuthSessionCache();
    globalThis.fetch = async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    };
    const signedOut = await getAuthSession();
    assert.equal(fetchCount, 2);
    assert.equal(signedOut.authenticated, false);
  } finally {
    clearAuthSessionCache();
    globalThis.fetch = originalFetch;
  }
});

test('auth session client does not let stale in-flight checks overwrite a primed login session', async () => {
  const {
    clearAuthSessionCache,
    getAuthSession,
    primeAuthSession,
  } = await import('../app/auth-session-client.ts');
  const originalFetch = globalThis.fetch;
  let resolveSessionCheck;

  try {
    clearAuthSessionCache();
    globalThis.fetch = async () => {
      await new Promise((resolve) => {
        resolveSessionCheck = resolve;
      });
      return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    };

    const pendingSessionCheck = getAuthSession();
    primeAuthSession({
      authenticated: true,
      user: {
        id: 'user_member',
        email: 'member@example.com',
        name: 'Member',
        profileImageDataUrl: null,
        role: 'member',
        accountStatus: 'active',
      },
    });

    resolveSessionCheck();
    const settledSession = await pendingSessionCheck;
    const cachedSession = await getAuthSession();

    assert.equal(settledSession.authenticated, true);
    assert.equal(settledSession.user?.email, 'member@example.com');
    assert.equal(cachedSession.authenticated, true);
    assert.equal(cachedSession.user?.email, 'member@example.com');
  } finally {
    clearAuthSessionCache();
    globalThis.fetch = originalFetch;
  }
});
