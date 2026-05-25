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

const txidPayments = [
  { payment: { id: 'pay_usdt_unchecked', status: 'pending', method: 'usdt', transactionId: 'tx_1', transactionVerificationStatus: 'unchecked' } },
  { payment: { id: 'pay_usdt_failed', status: 'pending', method: 'usdt', transactionId: 'tx_2', transactionVerificationStatus: 'failed' } },
  { payment: { id: 'pay_usdt_verified', status: 'pending', method: 'usdt', transactionId: 'tx_3', transactionVerificationStatus: 'verified' } },
  { payment: { id: 'pay_bank_pending', status: 'pending', method: 'bank', transactionId: null, transactionVerificationStatus: 'unchecked' } },
];

test('payment queue filter presets cover common manual operation states', () => {
  assert.deepEqual(PAYMENT_QUEUE_FILTER_PRESETS.map((preset) => preset.label), [
    '전체',
    '입금 대기',
    '확인 완료',
    '환불 완료',
    '반려',
    'TXID 미확인',
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

test('payment queue filters USDT payments that still need TXID review', () => {
  assert.deepEqual(filterPaymentQueueItems(txidPayments, 'txid_unchecked').map((item) => item.payment.id), [
    'pay_usdt_unchecked',
    'pay_usdt_failed',
  ]);
  assert.equal(getPaymentQueueFilterCount(txidPayments, 'txid_unchecked'), 2);
  assert.equal(getPaymentQueueFilterPreset('txid_unchecked').label, 'TXID 미확인');
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
