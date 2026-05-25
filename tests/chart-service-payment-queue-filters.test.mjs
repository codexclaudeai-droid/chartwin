import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterPaymentQueueItems,
  getPaymentQueueFilterCount,
  getPaymentQueueFilterPreset,
  PAYMENT_QUEUE_FILTER_PRESETS,
} from '../app/admin/payment-queue-filters.ts';

const payments = [
  { payment: { id: 'pay_pending', status: 'pending' } },
  { payment: { id: 'pay_confirmed', status: 'confirmed' } },
  { payment: { id: 'pay_refunded', status: 'refunded' } },
  { payment: { id: 'pay_rejected', status: 'rejected' } },
];

test('payment queue filter presets cover common manual operation states', () => {
  assert.deepEqual(PAYMENT_QUEUE_FILTER_PRESETS.map((preset) => preset.label), [
    '전체',
    '입금 대기',
    '확인 완료',
    '환불 완료',
    '반려',
  ]);

  assert.deepEqual(getPaymentQueueFilterPreset('pending'), {
    key: 'pending',
    label: '입금 대기',
    status: 'pending',
  });
});

test('payment queue filters narrow items by payment status', () => {
  assert.deepEqual(filterPaymentQueueItems(payments, 'pending').map((item) => item.payment.id), ['pay_pending']);
  assert.deepEqual(filterPaymentQueueItems(payments, 'refunded').map((item) => item.payment.id), ['pay_refunded']);
  assert.deepEqual(filterPaymentQueueItems(payments, 'rejected').map((item) => item.payment.id), ['pay_rejected']);
});

test('payment queue filter counts summarize each preset', () => {
  assert.equal(getPaymentQueueFilterCount(payments, 'all'), 4);
  assert.equal(getPaymentQueueFilterCount(payments, 'pending'), 1);
  assert.equal(getPaymentQueueFilterCount(payments, 'confirmed'), 1);
  assert.equal(getPaymentQueueFilterCount(payments, 'missing'), 4);
});

test('unknown payment queue filter falls back to all payments', () => {
  assert.deepEqual(filterPaymentQueueItems(payments, 'missing').map((item) => item.payment.id), [
    'pay_pending',
    'pay_confirmed',
    'pay_refunded',
    'pay_rejected',
  ]);
});
