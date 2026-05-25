export type PaymentQueueFilterPreset = {
  key: string;
  label: string;
  status: string;
};

type FilterablePaymentQueueItem = {
  payment: {
    status: string;
    method?: string;
    transactionId?: string | null;
    transactionVerificationStatus?: string | null;
  };
};

export const PAYMENT_QUEUE_FILTER_PRESETS: PaymentQueueFilterPreset[] = [
  { key: 'all', label: '전체', status: '' },
  { key: 'pending', label: '입금 대기', status: 'pending' },
  { key: 'confirmed', label: '확인 완료', status: 'confirmed' },
  { key: 'refunded', label: '환불 완료', status: 'refunded' },
  { key: 'rejected', label: '반려', status: 'rejected' },
  { key: 'txid_unchecked', label: 'TXID 미확인', status: '' },
];

export function getPaymentQueueFilterPreset(key: string): PaymentQueueFilterPreset {
  return PAYMENT_QUEUE_FILTER_PRESETS.find((preset) => preset.key === key) ?? PAYMENT_QUEUE_FILTER_PRESETS[0];
}

export function filterPaymentQueueItems<T extends FilterablePaymentQueueItem>(items: T[], key: string): T[] {
  const preset = getPaymentQueueFilterPreset(key);
  if (preset.key === 'txid_unchecked') {
    return items.filter((item) => (
      item.payment.method === 'usdt'
      && Boolean(item.payment.transactionId)
      && ['unchecked', 'failed'].includes(item.payment.transactionVerificationStatus ?? 'unchecked')
    ));
  }

  return preset.status
    ? items.filter((item) => item.payment.status === preset.status)
    : items;
}

export function getPaymentQueueFilterCount<T extends FilterablePaymentQueueItem>(items: T[], key: string): number {
  return filterPaymentQueueItems(items, key).length;
}
