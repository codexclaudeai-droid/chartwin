import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getProfilePaymentFlowSteps } from '../app/profile/profile-payment-flow.ts';

test('profile payment flow marks pending payments as waiting for admin deposit confirmation', () => {
  const steps = getProfilePaymentFlowSteps({
    paymentStatus: 'pending',
    subscriptionStatus: 'payment_pending',
  });

  assert.deepEqual(steps.map((step) => step.state), ['done', 'current', 'waiting']);
  assert.deepEqual(steps.map((step) => step.label), ['요청 접수', '입금확인', '구독승인']);
  assert.match(steps[1].description, /관리자/);
});

test('profile payment flow marks confirmed payments as waiting for subscription approval', () => {
  const steps = getProfilePaymentFlowSteps({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'payment_requested',
  });

  assert.deepEqual(steps.map((step) => step.state), ['done', 'done', 'current']);
  assert.match(steps[2].description, /구독 승인/);
});

test('profile payment flow marks active subscriptions as fully done', () => {
  const steps = getProfilePaymentFlowSteps({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'active',
  });

  assert.deepEqual(steps.map((step) => step.state), ['done', 'done', 'done']);
});

test('profile payment flow blocks rejected payment progress', () => {
  const steps = getProfilePaymentFlowSteps({
    paymentStatus: 'rejected',
    subscriptionStatus: 'cancelled',
  });

  assert.deepEqual(steps.map((step) => step.state), ['done', 'blocked', 'blocked']);
  assert.match(steps[1].description, /반려/);
});

test('profile payment panel renders the payment progress timeline', () => {
  const source = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /getProfilePaymentFlowSteps/);
  assert.match(source, /payment-flow-steps/);
  assert.match(source, /id=\{`payment-\$\{payment\.id\}`\}/);
  assert.match(source, /aria-label=\{`\$\{payment\.id\} 결제 진행 단계`\}/);
});

test('profile payment target has a visual anchor treatment', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /targetPaymentId/);
  assert.match(panelSource, /window\.location\.hash/);
  assert.match(panelSource, /hashchange/);
  assert.match(panelSource, /scrollIntoView/);
  assert.match(panelSource, /payment-card-target/);
  assert.match(source, /\.payment-card\.payment-card-target/);
  assert.match(source, /\.payment-card:target/);
});
