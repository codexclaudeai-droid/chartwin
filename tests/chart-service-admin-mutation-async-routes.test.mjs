import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminMutationRoutes = [
  '../app/api/admin/payments/confirm/route.ts',
  '../app/api/admin/payments/refund/route.ts',
  '../app/api/admin/payments/reject/route.ts',
  '../app/api/admin/subscriptions/cancel/route.ts',
  '../app/api/admin/subscriptions/refund/route.ts',
  '../app/api/admin/subscriptions/reject/route.ts',
  '../app/api/admin/support/reply/route.ts',
  '../app/api/admin/users/[id]/route.ts',
];

test('admin mutation routes use the async persistence boundary', () => {
  for (const routePath of adminMutationRoutes) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /getAsyncChartServicePersistence/, `${routePath} should create async persistence`);
    assert.match(source, /runMutation/, `${routePath} should execute changes inside a mutation scope`);
    assert.match(source, /getActorFromAsyncRequest/, `${routePath} should authenticate with async repository access`);
    assert.doesNotMatch(source, /getChartServiceRepository\(/, `${routePath} should not use the sync singleton directly`);
    assert.doesNotMatch(source, /requireAdminFromRequest\(/, `${routePath} should not use the sync admin guard directly`);
  }
});

test('admin mutation routes return 401 when the admin session is missing', async () => {
  const routeCases = [
    {
      routePath: '../app/api/admin/payments/confirm/route.ts',
      request: new Request('http://localhost/api/admin/payments/confirm', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId: 'pay_pending' }),
      }),
    },
    {
      routePath: '../app/api/admin/payments/reject/route.ts',
      request: new Request('http://localhost/api/admin/payments/reject', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId: 'pay_pending', adminNote: 'reject' }),
      }),
    },
    {
      routePath: '../app/api/admin/subscriptions/cancel/route.ts',
      request: new Request('http://localhost/api/admin/subscriptions/cancel', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ subscriptionId: 'sub_active', adminNote: 'cancel' }),
      }),
    },
    {
      routePath: '../app/api/admin/support/reply/route.ts',
      request: new Request('http://localhost/api/admin/support/reply', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: 'support_public_notice', body: 'reply' }),
      }),
    },
    {
      routePath: '../app/api/admin/users/[id]/route.ts',
      request: new Request('http://localhost/api/admin/users/user_member', {
        method: 'PATCH',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'trial' }),
      }),
      context: { params: Promise.resolve({ id: 'user_member' }) },
    },
  ];

  for (const routeCase of routeCases) {
    const route = await import(routeCase.routePath);
    const response = await route[routeCase.context ? 'PATCH' : 'POST'](routeCase.request, routeCase.context);
    const payload = await response.json();

    assert.equal(response.status, 401, routeCase.routePath);
    assert.equal(payload.ok, false, routeCase.routePath);
  }
});
