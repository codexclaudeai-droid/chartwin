export type AdminConfirmFn = (message: string) => boolean;

export type AdminActionConfirmationDetails = {
  actionLabel: string;
  description: string;
  targetLabel: string;
  title: string;
};

export const ADMIN_ACTION_CONFIRMATION_LABELS: Record<string, string> = {
  'payment.confirm': '입금 확인',
  'payment.provisionalSale': '가매출승인',
  'payment.refund': '환불 처리',
  'payment.reject': '결제 반려',
  'subscription.approve': '구독 승인',
  'subscription.cancel': '구독 취소 승인',
  'subscription.refund': '구독 환불 승인',
  'subscription.reject': '구독 요청 반려',
  'admin.user.role.update': '회원 역할 변경',
  'admin.user.account.suspend': '계정 정지',
  'admin.user.account.activate': '계정 정지 해제',
};

export function getAdminActionConfirmationDetails(action: string, targetLabel: string): AdminActionConfirmationDetails {
  const actionLabel = ADMIN_ACTION_CONFIRMATION_LABELS[action] ?? action;

  return {
    actionLabel,
    description: '확인 시 관리자 감사 로그에 기록됩니다. 되돌리기 어려운 작업이면 처리 메모와 대상 정보를 다시 확인해주세요.',
    targetLabel,
    title: '관리자 작업 확인',
  };
}

export function getAdminActionConfirmationMessage(action: string, targetLabel: string): string {
  const details = getAdminActionConfirmationDetails(action, targetLabel);

  return `${details.actionLabel} 작업을 진행할까요?\n대상: ${details.targetLabel}\n${details.description}`;
}

export function shouldRunAdminAction(
  action: string,
  targetLabel: string,
  confirmFn: AdminConfirmFn = defaultAdminConfirm,
): boolean {
  return confirmFn(getAdminActionConfirmationMessage(action, targetLabel));
}

function defaultAdminConfirm(message: string): boolean {
  const confirmFn = (globalThis as typeof globalThis & { confirm?: AdminConfirmFn }).confirm;

  if (typeof confirmFn !== 'function') {
    return false;
  }

  return confirmFn(message);
}
