import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterSubscriptionQueueItems,
  getSubscriptionQueueFilterCount,
  getSubscriptionQueueFilterPreset,
  SUBSCRIPTION_QUEUE_FILTER_PRESETS,
} from '../app/admin/subscription-queue-filters.ts';

const subscriptions = [
  { subscription: { id: 'sub_payment_pending', status: 'payment_pending' } },
  { subscription: { id: 'sub_payment_requested', status: 'payment_requested' } },
  { subscription: { id: 'sub_cancel_requested', status: 'cancel_requested' } },
  { subscription: { id: 'sub_refund_requested', status: 'refund_requested' } },
];

test('subscription queue filter presets cover common admin request states', () => {
  assert.deepEqual(SUBSCRIPTION_QUEUE_FILTER_PRESETS.map((preset) => preset.label), [
    '전체',
    '입금 대기',
    '결제 요청',
    '취소 요청',
    '환불 요청',
  ]);

  assert.deepEqual(getSubscriptionQueueFilterPreset('refund_requested'), {
    key: 'refund_requested',
    label: '환불 요청',
    status: 'refund_requested',
  });
});

test('subscription queue filters narrow items by subscription status', () => {
  assert.deepEqual(filterSubscriptionQueueItems(subscriptions, 'payment_pending').map((item) => item.subscription.id), ['sub_payment_pending']);
  assert.deepEqual(filterSubscriptionQueueItems(subscriptions, 'payment_requested').map((item) => item.subscription.id), ['sub_payment_requested']);
  assert.deepEqual(filterSubscriptionQueueItems(subscriptions, 'cancel_requested').map((item) => item.subscription.id), ['sub_cancel_requested']);
  assert.deepEqual(filterSubscriptionQueueItems(subscriptions, 'refund_requested').map((item) => item.subscription.id), ['sub_refund_requested']);
});

test('subscription queue filter count mirrors filtered results', () => {
  assert.equal(getSubscriptionQueueFilterCount(subscriptions, 'all'), 4);
  assert.equal(getSubscriptionQueueFilterCount(subscriptions, 'payment_requested'), 1);
  assert.equal(getSubscriptionQueueFilterCount(subscriptions, 'cancel_requested'), 1);
  assert.equal(getSubscriptionQueueFilterCount(subscriptions, 'missing'), 4);
});

test('unknown subscription queue filter falls back to all subscriptions', () => {
  assert.deepEqual(filterSubscriptionQueueItems(subscriptions, 'missing').map((item) => item.subscription.id), [
    'sub_payment_pending',
    'sub_payment_requested',
    'sub_cancel_requested',
    'sub_refund_requested',
  ]);
});
