import type { SubscriptionStatus } from '../../src/domain/chart-service/index.ts';

export type SubscriptionActionAvailability = {
  canCancel: boolean;
  canRefund: boolean;
  reason: string;
};

export function getSubscriptionActionAvailability(
  status: SubscriptionStatus | string | null | undefined,
): SubscriptionActionAvailability {
  switch (status) {
    case 'active':
      return {
        canCancel: true,
        canRefund: true,
        reason: '활성 구독은 취소 또는 환불 요청을 접수할 수 있습니다.',
      };
    case 'expiring':
      return {
        canCancel: true,
        canRefund: true,
        reason: '만료 예정 구독은 취소 또는 환불 요청을 접수할 수 있습니다.',
      };
    case 'cancel_requested':
      return {
        canCancel: false,
        canRefund: false,
        reason: '이미 취소 요청이 접수되어 관리자 확인을 기다리고 있습니다.',
      };
    case 'refund_requested':
      return {
        canCancel: false,
        canRefund: false,
        reason: '이미 환불 요청이 접수되어 관리자 확인을 기다리고 있습니다.',
      };
    case 'payment_pending':
    case 'payment_requested':
      return {
        canCancel: false,
        canRefund: false,
        reason: '입금확인 또는 구독승인 대기 중에는 취소/환불 요청을 먼저 접수할 수 없습니다.',
      };
    default:
      return {
        canCancel: false,
        canRefund: false,
        reason: '현재 활성 구독이 없습니다. 구독 활성화 후 취소 또는 환불 요청이 가능합니다.',
      };
  }
}
