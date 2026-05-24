import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('password policy requires length, uppercase, lowercase, number, and special character', async () => {
  const { validatePasswordPolicy } = await import('../src/domain/chart-service/index.ts');

  assert.deepEqual(validatePasswordPolicy('Aa1!aa').ok, false);
  assert.deepEqual(validatePasswordPolicy('aa1!aaaa').missing, ['uppercase']);
  assert.deepEqual(validatePasswordPolicy('AA1!AAAA').missing, ['lowercase']);
  assert.deepEqual(validatePasswordPolicy('Aa!!aaaa').missing, ['number']);
  assert.deepEqual(validatePasswordPolicy('Aa11aaaa').missing, ['special']);
  assert.deepEqual(validatePasswordPolicy('Aa1!aaaa').ok, true);
});

test('profile image upload policy blocks svg, gif, oversized, and mismatched mime files', async () => {
  const { validateProfileImageUpload } = await import('../src/domain/chart-service/index.ts');

  assert.equal(validateProfileImageUpload({ filename: 'avatar.png', mimeType: 'image/png', sizeBytes: 200_000 }).ok, true);
  assert.equal(validateProfileImageUpload({ filename: 'avatar.svg', mimeType: 'image/svg+xml', sizeBytes: 20_000 }).ok, false);
  assert.equal(validateProfileImageUpload({ filename: 'avatar.gif', mimeType: 'image/gif', sizeBytes: 20_000 }).ok, false);
  assert.equal(validateProfileImageUpload({ filename: 'avatar.jpg', mimeType: 'image/png', sizeBytes: 20_000 }).ok, false);
  assert.equal(validateProfileImageUpload({ filename: 'avatar.webp', mimeType: 'image/webp', sizeBytes: 200_001 }).ok, false);
});

test('admin guard allows admin and super admin only', async () => {
  const { assertAdminActor } = await import('../src/domain/chart-service/index.ts');

  assert.doesNotThrow(() => assertAdminActor({ id: 'admin_1', role: 'admin' }));
  assert.doesNotThrow(() => assertAdminActor({ id: 'super_1', role: 'super_admin' }));
  assert.throws(() => assertAdminActor({ id: 'user_1', role: 'subscriber' }), /Admin role required/);
});

test('super admin guard blocks normal admins', async () => {
  const { assertSuperAdminActor } = await import('../src/domain/chart-service/index.ts');

  assert.doesNotThrow(() => assertSuperAdminActor({ id: 'super_1', role: 'super_admin' }));
  assert.throws(() => assertSuperAdminActor({ id: 'admin_1', role: 'admin' }), /Super admin role required/);
});

test('audit log draft records before and after payloads for admin actions', async () => {
  const { createAuditLogDraft } = await import('../src/domain/chart-service/index.ts');

  const draft = createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'subscription.approve',
    targetType: 'subscription',
    targetId: 'sub_1',
    beforeJson: { status: 'payment_pending' },
    afterJson: { status: 'active' },
  });

  assert.equal(draft.actorAdminId, 'admin_1');
  assert.equal(draft.action, 'subscription.approve');
  assert.deepEqual(draft.beforeJson, { status: 'payment_pending' });
  assert.deepEqual(draft.afterJson, { status: 'active' });
});

test('same-origin mutation guard allows same-origin requests and blocks cross-site origins', async () => {
  const {
    guardMutationRequest,
    assertSameOriginMutationRequest,
    isSameOriginMutationRequest,
    resetChartServiceRateLimits,
  } = await import('../src/server/chart-service/index.ts');

  resetChartServiceRateLimits();
  assert.equal(isSameOriginMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
  })), true);
  assert.equal(isSameOriginMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { origin: 'http://localhost' },
  })), true);
  assert.equal(isSameOriginMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { origin: 'https://evil.example' },
  })), false);
  assert.equal(isSameOriginMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { referer: 'https://evil.example/account' },
  })), false);
  assert.throws(() => assertSameOriginMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { origin: 'https://evil.example' },
  })), /Cross-site request blocked/);

  const blocked = guardMutationRequest(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { origin: 'https://evil.example' },
  }));
  assert.equal(blocked?.status, 403);
});

test('mutation guard returns 429 when a request exceeds its rate limit', async () => {
  const {
    guardMutationRequest,
    resetChartServiceRateLimits,
  } = await import('../src/server/chart-service/index.ts');

  resetChartServiceRateLimits();
  const makeRequest = () => new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'x-forwarded-for': '203.0.113.10',
    },
  });

  assert.equal(guardMutationRequest(makeRequest(), {
    limit: 2,
    scope: 'auth.login.test',
    windowMs: 60_000,
    nowMs: 1_000,
  }), null);
  assert.equal(guardMutationRequest(makeRequest(), {
    limit: 2,
    scope: 'auth.login.test',
    windowMs: 60_000,
    nowMs: 1_100,
  }), null);

  const limited = guardMutationRequest(makeRequest(), {
    limit: 2,
    scope: 'auth.login.test',
    windowMs: 60_000,
    nowMs: 1_200,
  });
  assert.equal(limited?.status, 429);
  assert.equal(limited?.headers.get('Retry-After'), '60');
});

test('state-changing API routes enforce same-origin mutation checks', () => {
  const mutatingRoutes = [
    '../app/api/profile/route.ts',
    '../app/api/profile/image-policy/route.ts',
    '../app/api/support/threads/route.ts',
    '../app/api/auth/signup/route.ts',
    '../app/api/auth/logout/route.ts',
    '../app/api/auth/login/route.ts',
    '../app/api/payments/request/route.ts',
    '../app/api/subscription/cancel-request/route.ts',
    '../app/api/subscription/refund-request/route.ts',
    '../app/api/notifications/read-all/route.ts',
    '../app/api/notifications/[id]/read/route.ts',
    '../app/api/admin/users/[id]/route.ts',
    '../app/api/admin/payments/confirm/route.ts',
    '../app/api/admin/payments/refund/route.ts',
    '../app/api/admin/payments/reject/route.ts',
    '../app/api/admin/subscriptions/cancel/route.ts',
    '../app/api/admin/subscriptions/refund/route.ts',
    '../app/api/admin/subscriptions/reject/route.ts',
    '../app/api/admin/support/reply/route.ts',
  ];

  for (const routePath of mutatingRoutes) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /guardMutationRequest\(request/, routePath);
  }
});
