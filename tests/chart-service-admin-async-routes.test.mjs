import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminReadRoutes = [
  '../app/api/admin/dashboard/route.ts',
  '../app/api/admin/statistics/route.ts',
  '../app/api/admin/payments/route.ts',
  '../app/api/admin/subscriptions/route.ts',
  '../app/api/admin/audit-logs/route.ts',
  '../app/api/admin/audit-preview/route.ts',
  '../app/api/admin/users/route.ts',
];

test('admin read routes use the async persistence boundary', () => {
  for (const routePath of adminReadRoutes) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /getAsyncChartServicePersistence/, `${routePath} should create async persistence`);
    assert.match(source, /runRead/, `${routePath} should execute inside a read scope`);
    assert.match(source, /getActorFromAsyncRequest/, `${routePath} should authenticate with async repository access`);
    assert.doesNotMatch(source, /getChartServiceRepository\(/, `${routePath} should not use the sync singleton directly`);
    assert.doesNotMatch(source, /requireAdminFromRequest\(/, `${routePath} should not use the sync admin guard directly`);
  }
});

test('payment confirmation route no longer activates subscriptions directly', () => {
  const source = readFileSync(new URL('../app/api/admin/payments/confirm/route.ts', import.meta.url), 'utf8');

  assert.match(source, /confirmAsyncManualPaymentRequest/);
  assert.doesNotMatch(source, /confirmAsyncManualPaymentAndActivateSubscription/);
});
