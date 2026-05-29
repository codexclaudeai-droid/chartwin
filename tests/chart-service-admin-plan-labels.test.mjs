import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAdminPlanPeriodLabel } from '../app/admin/admin-plan-labels.ts';

test('admin plan period labels hide internal English plan names', () => {
  assert.equal(formatAdminPlanPeriodLabel({ id: 'plan_monthly', name: 'Monthly' }), '1개월');
  assert.equal(formatAdminPlanPeriodLabel({ id: 'plan_half_year', name: 'Half Year' }), '6개월');
  assert.equal(formatAdminPlanPeriodLabel({ id: 'plan_yearly', name: 'Yearly' }), '12개월');
});

test('admin plan period labels can fall back from legacy plan names', () => {
  assert.equal(formatAdminPlanPeriodLabel('Monthly'), '1개월');
  assert.equal(formatAdminPlanPeriodLabel('Half Year'), '6개월');
  assert.equal(formatAdminPlanPeriodLabel('Yearly'), '12개월');
  assert.equal(formatAdminPlanPeriodLabel({ id: 'custom', name: 'Custom Plan' }), 'Custom Plan');
});
