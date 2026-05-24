const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '입금 대기',
  confirmed: '입금 확인',
  refunded: '환불 완료',
  rejected: '반려',
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  none: '구독 없음',
  payment_pending: '입금 대기',
  payment_requested: '결제 요청',
  trial_active: '무료 체험',
  active: '구독 활성',
  expiring: '만료 예정',
  expired: '만료',
  cancel_requested: '취소 요청',
  cancelled: '취소 완료',
  refund_requested: '환불 요청',
  refunded: '환불 완료',
};

const SUPPORT_STATUS_LABELS: Record<string, string> = {
  waiting: '답변 대기',
  answered: '답변 완료',
};

const SUPPORT_VISIBILITY_LABELS: Record<string, string> = {
  public: '공개',
  private: '비공개',
};

const USER_ROLE_LABELS: Record<string, string> = {
  member: '회원',
  trial: '체험 회원',
  subscriber: '구독 회원',
  salesperson: '영업',
  admin: '관리자',
  super_admin: '최고관리자',
};

const USER_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: '정상',
  suspended: '정지',
};

export function formatPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function formatSubscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status;
}

export function formatSupportStatusLabel(status: string): string {
  return SUPPORT_STATUS_LABELS[status] ?? status;
}

export function formatSupportVisibilityLabel(visibility: string): string {
  return SUPPORT_VISIBILITY_LABELS[visibility] ?? visibility;
}

export function formatUserRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export function formatUserAccountStatusLabel(status: string): string {
  return USER_ACCOUNT_STATUS_LABELS[status] ?? status;
}
