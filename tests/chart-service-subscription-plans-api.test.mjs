import assert from 'node:assert/strict';
import test from 'node:test';

test('subscription plans API uses an awaitable persistence boundary', async () => {
  const { GET } = await import('../app/api/subscription/plans/route.ts');

  const responsePromise = GET();
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(payload.plans), true);
  assert.equal(payload.plans.length > 0, true);
  assert.equal(payload.plans.every((plan) => typeof plan.id === 'string'), true);
});
