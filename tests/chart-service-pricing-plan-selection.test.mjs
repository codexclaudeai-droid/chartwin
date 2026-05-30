import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createPricingPlanHref,
  resolveInitialPricingPlanId,
} from '../app/pricing/plan-selection.ts';

const plans = [
  { id: 'plan_monthly' },
  { id: 'plan_half_year' },
  { id: 'plan_yearly' },
];

test('pricing page selects the plan requested by the landing URL', () => {
  assert.equal(resolveInitialPricingPlanId(plans, 'plan_half_year'), 'plan_half_year');
  assert.equal(resolveInitialPricingPlanId(plans, 'plan_yearly'), 'plan_yearly');
});

test('pricing page falls back to the first plan for missing or unknown plan ids', () => {
  assert.equal(resolveInitialPricingPlanId(plans, null), 'plan_monthly');
  assert.equal(resolveInitialPricingPlanId(plans, 'unknown_plan'), 'plan_monthly');
});

test('landing plan links carry the selected plan id into pricing', () => {
  assert.equal(createPricingPlanHref('plan_yearly'), '/pricing?plan=plan_yearly');

  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /href=\{createPricingPlanHref\(plan\.id\)\}/);
});
