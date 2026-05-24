import type { PaymentStatus, SubscriptionStatus } from './types.ts';

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: '구독 없음',
  trial_requested: '무료 체험 신청',
  trial_active: '무료 체험 중',
  trial_expired: '무료 체험 만료',
  payment_requested: '결제 요청 접수',
  payment_pending: '입금 확인 대기',
  active: '구독 활성',
  expiring: '구독 만료 예정',
  expired: '구독 만료',
  cancel_requested: '취소 승인 대기',
  cancelled: '취소 완료',
  refund_requested: '환불 승인 대기',
  refunded: '환불 완료',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  requested: '결제 요청 접수',
  pending: '입금 확인 대기',
  confirmed: '입금 확인 완료',
  rejected: '결제 반려',
  cancelled: '결제 취소',
  refunded: '환불 완료',
};

export function formatSubscriptionStatusLabel(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_LABELS[status];
}

export function formatPaymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status];
}

export function formatChartAccessLabel(access: { fullChart: boolean; paidSignals: boolean }): string {
  if (access.fullChart && access.paidSignals) return '전체 차트와 유료 시그널 이용 가능';
  if (access.fullChart) return '차트 이용 가능, 유료 시그널 승인 대기';
  return '구독 승인 후 이용 가능';
}

export function formatPaymentAmountUsd(amountUsd: number): string {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(amountUsd);
}

