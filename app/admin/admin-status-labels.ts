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

export type AdminManualFlowTone = 'waiting' | 'ready' | 'done' | 'blocked' | 'neutral';

export type AdminManualFlowBadge = {
  label: string;
  description: string;
  tone: AdminManualFlowTone;
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

export function getAdminPaymentFlowBadge(input: {
  paymentStatus: string;
  subscriptionStatus?: string | null;
}): AdminManualFlowBadge {
  if (input.paymentStatus === 'pending' || input.paymentStatus === 'requested') {
    return {
      label: '입금확인 대기',
      description: '요청글과 실제 입금 내역을 대조하세요.',
      tone: 'waiting',
    };
  }

  if (input.paymentStatus === 'confirmed' && input.subscriptionStatus === 'payment_requested') {
    return {
      label: '입금확인 완료 · 구독승인 대기',
      description: '구독 요청 관리에서 최종 승인을 처리하세요.',
      tone: 'ready',
    };
  }

  if (input.paymentStatus === 'confirmed' && input.subscriptionStatus === 'active') {
    return {
      label: '구독승인 완료',
      description: '입금확인과 구독승인이 모두 완료되었습니다.',
      tone: 'done',
    };
  }

  if (input.paymentStatus === 'confirmed') {
    return {
      label: '입금확인 완료',
      description: '연결된 구독 상태를 확인하세요.',
      tone: 'done',
    };
  }

  if (input.paymentStatus === 'rejected') {
    return {
      label: '반려 완료',
      description: '입금 미확인으로 요청이 반려되었습니다.',
      tone: 'blocked',
    };
  }

  if (input.paymentStatus === 'refunded') {
    return {
      label: '환불 완료',
      description: '환불과 구독 정리가 완료되었습니다.',
      tone: 'blocked',
    };
  }

  return {
    label: formatPaymentStatusLabel(input.paymentStatus),
    description: '상세 상태를 확인하세요.',
    tone: 'neutral',
  };
}

export function getAdminSubscriptionFlowBadge(input: {
  subscriptionStatus: string;
  paymentStatus?: string | null;
}): AdminManualFlowBadge {
  if (input.subscriptionStatus === 'payment_pending') {
    return {
      label: '입금확인 대기',
      description: '결제 요청 관리에서 입금 확인을 먼저 처리하세요.',
      tone: 'waiting',
    };
  }

  if (input.subscriptionStatus === 'payment_requested' && input.paymentStatus === 'confirmed') {
    return {
      label: '입금확인 완료 · 구독승인 대기',
      description: '이 단계에서 구독 승인 버튼으로 최종 처리하세요.',
      tone: 'ready',
    };
  }

  if (input.subscriptionStatus === 'payment_requested') {
    return {
      label: '구독승인 대기',
      description: '연결된 결제 상태를 확인한 뒤 승인하세요.',
      tone: 'ready',
    };
  }

  if (input.subscriptionStatus === 'active') {
    return {
      label: '구독승인 완료',
      description: '회원이 유료 차트와 시그널을 이용할 수 있습니다.',
      tone: 'done',
    };
  }

  if (input.subscriptionStatus === 'cancel_requested') {
    return {
      label: '취소 승인 대기',
      description: '관리자 확인 후 취소 승인 또는 반려를 처리하세요.',
      tone: 'waiting',
    };
  }

  if (input.subscriptionStatus === 'refund_requested') {
    return {
      label: '환불 승인 대기',
      description: '관리자 확인 후 환불 승인 또는 반려를 처리하세요.',
      tone: 'waiting',
    };
  }

  if (input.subscriptionStatus === 'cancelled') {
    return {
      label: '취소 완료',
      description: '구독 취소 처리가 완료되었습니다.',
      tone: 'blocked',
    };
  }

  if (input.subscriptionStatus === 'refunded') {
    return {
      label: '환불 완료',
      description: '구독 환불 처리가 완료되었습니다.',
      tone: 'blocked',
    };
  }

  return {
    label: formatSubscriptionStatusLabel(input.subscriptionStatus),
    description: '상세 상태를 확인하세요.',
    tone: 'neutral',
  };
}
