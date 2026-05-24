type AdminDashboardPrioritySummary = {
  payments: {
    pendingCount: number;
  };
  subscriptions: {
    queueCount: number;
  };
  support: {
    waitingCount: number;
  };
  users?: {
    suspendedCount: number;
  };
};

export type AdminDashboardPriority = {
  key: 'payments' | 'subscriptions' | 'support' | 'users' | 'clear';
  title: string;
  description: string;
  href: string;
  panel?: 'payments' | 'subscriptions' | 'support' | 'users';
  presetKey?: string;
  tone: 'urgent' | 'warning' | 'calm';
};

export type AdminDashboardQueueItem = Omit<AdminDashboardPriority, 'key'> & {
  key: 'payments' | 'subscriptions' | 'support' | 'users';
  panel: 'payments' | 'subscriptions' | 'support' | 'users';
  presetKey: string;
  countLabel: string;
  actionLabel: string;
  filterLabel: string;
};

export function getAdminDashboardQueueItems(summary: AdminDashboardPrioritySummary): AdminDashboardQueueItem[] {
  const items: AdminDashboardQueueItem[] = [];

  if (summary.payments.pendingCount > 0) {
    items.push({
      key: 'payments',
      panel: 'payments',
      presetKey: 'pending',
      title: '입금 확인',
      countLabel: `${summary.payments.pendingCount}건`,
      actionLabel: '입금 내역 확인 후 승인/반려',
      filterLabel: '입금 대기',
      description: '입금 확인, 승인, 반려가 필요한 결제 요청입니다.',
      href: '#admin-payments',
      tone: 'urgent',
    });
  }

  if (summary.subscriptions.queueCount > 0) {
    items.push({
      key: 'subscriptions',
      panel: 'subscriptions',
      presetKey: 'all',
      title: '구독 변경',
      countLabel: `${summary.subscriptions.queueCount}건`,
      actionLabel: '취소/환불 요청 검토',
      filterLabel: '전체',
      description: '구독 승인, 취소, 환불 요청을 검토해야 합니다.',
      href: '#admin-subscriptions',
      tone: 'warning',
    });
  }

  if (summary.support.waitingCount > 0) {
    items.push({
      key: 'support',
      panel: 'support',
      presetKey: 'waiting',
      title: '고객센터 답변',
      countLabel: `${summary.support.waitingCount}건`,
      actionLabel: '대기 문의 답변',
      filterLabel: '답변 대기',
      description: '아직 답변하지 않은 고객 문의입니다.',
      href: '#admin-support',
      tone: 'warning',
    });
  }

  const suspendedCount = summary.users?.suspendedCount ?? 0;
  if (suspendedCount > 0) {
    items.push({
      key: 'users',
      panel: 'users',
      presetKey: 'suspended',
      title: '정지 계정',
      countLabel: `${suspendedCount}명`,
      actionLabel: '정지 사유 검토',
      filterLabel: '정지',
      description: '정지 상태 회원을 검토하고 후속 조치를 기록하세요.',
      href: '#admin-users',
      tone: 'warning',
    });
  }

  return items;
}

export function getAdminDashboardPriority(summary: AdminDashboardPrioritySummary): AdminDashboardPriority {
  if (summary.payments.pendingCount > 0) {
    return {
      key: 'payments',
      title: '입금 확인 대기',
      description: `입금 확인이 필요한 결제 ${summary.payments.pendingCount}건을 먼저 확인하세요.`,
      href: '#admin-payments',
      panel: 'payments',
      presetKey: 'pending',
      tone: 'urgent',
    };
  }

  if (summary.subscriptions.queueCount > 0) {
    return {
      key: 'subscriptions',
      title: '구독 변경 처리',
      description: `승인, 취소, 환불 검토가 필요한 구독 요청 ${summary.subscriptions.queueCount}건이 있습니다.`,
      href: '#admin-subscriptions',
      panel: 'subscriptions',
      presetKey: 'all',
      tone: 'warning',
    };
  }

  if (summary.support.waitingCount > 0) {
    return {
      key: 'support',
      title: '고객센터 답변 대기',
      description: `아직 답변하지 않은 고객 문의 ${summary.support.waitingCount}건을 확인하세요.`,
      href: '#admin-support',
      panel: 'support',
      presetKey: 'waiting',
      tone: 'warning',
    };
  }

  if ((summary.users?.suspendedCount ?? 0) > 0) {
    return {
      key: 'users',
      title: '정지 계정 확인',
      description: `정지 상태인 회원 ${summary.users?.suspendedCount ?? 0}명을 사용자 관리에서 검토하세요.`,
      href: '#admin-users',
      panel: 'users',
      presetKey: 'suspended',
      tone: 'warning',
    };
  }

  return {
    key: 'clear',
    title: '대기 중인 운영 작업 없음',
    description: '현재 입금 확인, 구독 변경, 고객 문의 대기 건이 없습니다.',
    href: '#admin-audit-logs',
    tone: 'calm',
  };
}
