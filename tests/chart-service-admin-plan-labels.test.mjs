import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAdminPlanPeriodLabel,
  formatAdminPlanTierLabel,
} from '../app/admin/admin-plan-labels.ts';

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

test('admin plan tier labels distinguish Basic Pro and Elite plans', () => {
  assert.equal(formatAdminPlanTierLabel({ planId: 'plan_monthly' }), 'Basic');
  assert.equal(formatAdminPlanTierLabel({ planId: 'plan_half_year' }), 'Pro');
  assert.equal(formatAdminPlanTierLabel({ planId: 'plan_yearly' }), 'Elite');
  assert.equal(formatAdminPlanTierLabel({ id: 'plan_monthly', name: 'Monthly' }), 'Basic');
  assert.equal(formatAdminPlanTierLabel('Half Year'), 'Pro');
  assert.equal(formatAdminPlanTierLabel({ id: 'custom', name: 'Custom Plan' }), 'Custom Plan');
});
