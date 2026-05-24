import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProfilePaymentLink,
  createSupportThreadLink,
} from '../src/server/chart-service/notification-links.ts';

test('notification deep links target the relevant payment and support records', () => {
  assert.equal(createProfilePaymentLink('pay_pending'), '/profile#payment-pay_pending');
  assert.equal(createSupportThreadLink('support_101'), '/support?thread=support_101#support-support_101');
});

test('notification deep links encode ids used in URL query and hash fragments', () => {
  assert.equal(createProfilePaymentLink('pay 1'), '/profile#payment-pay%201');
  assert.equal(createSupportThreadLink('support 1'), '/support?thread=support%201#support-support%201');
});
