export type SubscriptionQueueFilterPreset = {
  key: string;
  label: string;
  status: string;
};

type FilterableSubscriptionQueueItem = {
  subscription: {
    status: string;
  };
};

export const SUBSCRIPTION_QUEUE_FILTER_PRESETS: SubscriptionQueueFilterPreset[] = [
  { key: 'all', label: '전체', status: '' },
  { key: 'payment_pending', label: '입금 대기', status: 'payment_pending' },
  { key: 'payment_requested', label: '결제 요청', status: 'payment_requested' },
  { key: 'cancel_requested', label: '취소 요청', status: 'cancel_requested' },
  { key: 'refund_requested', label: '환불 요청', status: 'refund_requested' },
];

export function getSubscriptionQueueFilterPreset(key: string): SubscriptionQueueFilterPreset {
  return SUBSCRIPTION_QUEUE_FILTER_PRESETS.find((preset) => preset.key === key) ?? SUBSCRIPTION_QUEUE_FILTER_PRESETS[0];
}

export function filterSubscriptionQueueItems<T extends FilterableSubscriptionQueueItem>(items: T[], key: string): T[] {
  const preset = getSubscriptionQueueFilterPreset(key);
  return preset.status
    ? items.filter((item) => item.subscription.status === preset.status)
    : items;
}

export function getSubscriptionQueueFilterCount<T extends FilterableSubscriptionQueueItem>(items: T[], key: string): number {
  return filterSubscriptionQueueItems(items, key).length;
}
