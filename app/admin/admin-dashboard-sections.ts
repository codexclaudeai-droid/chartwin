export type AdminDashboardSectionKey =
  | 'overview'
  | 'statistics'
  | 'sales'
  | 'users'
  | 'payments'
  | 'subscriptions'
  | 'support'
  | 'audit';

export type AdminDashboardSection = {
  key: AdminDashboardSectionKey;
  eyebrow: string;
  label: string;
  description: string;
  href: string;
};

export const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSection[] = [
  {
    key: 'overview',
    eyebrow: 'Overview',
    label: '운영 개요',
    description: '대기 작업과 서비스 상태를 한눈에 확인합니다.',
    href: '#admin-overview',
  },
  {
    key: 'statistics',
    eyebrow: 'Analytics',
    label: '통계',
    description: '매출, 가입자, 방문자 흐름을 일별, 월별, 년도별 차트로 확인합니다.',
    href: '#admin-statistics',
  },
  {
    key: 'sales',
    eyebrow: 'Sales',
    label: '영업관리',
    description: '영업자별 매출, 적립포인트, 개별 정산율을 관리합니다.',
    href: '#admin-sales',
  },
  {
    key: 'users',
    eyebrow: 'Members',
    label: '회원 관리',
    description: '회원 상태, 권한, 관련 이력을 확인합니다.',
    href: '#admin-users',
  },
  {
    key: 'payments',
    eyebrow: 'Deposits',
    label: '입금 확인',
    description: '입금확인 요청과 결제 반려를 수동 처리합니다.',
    href: '#admin-payments',
  },
  {
    key: 'subscriptions',
    eyebrow: 'Subscriptions',
    label: '구독 승인',
    description: '입금확인 이후 구독 승인, 환불, 취소를 처리합니다.',
    href: '#admin-subscriptions',
  },
  {
    key: 'support',
    eyebrow: 'Support',
    label: '고객센터',
    description: '문의 게시글과 입금확인 요청에 답변합니다.',
    href: '#admin-support',
  },
  {
    key: 'audit',
    eyebrow: 'Audit',
    label: '감사 로그',
    description: '관리자 조치와 변경 전후 데이터를 추적합니다.',
    href: '#admin-audit-logs',
  },
];

export function getAdminDashboardSectionFromLocation(
  hash: string,
  search = '',
): AdminDashboardSectionKey {
  const targetId = normalizeHashId(hash);
  const explicitSection = getSectionFromTargetId(targetId);
  if (explicitSection) {
    return explicitSection;
  }

  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (searchParams.has('supportThread')) {
    return 'support';
  }

  return 'overview';
}

function normalizeHashId(hash: string): string {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(rawHash);
  } catch {
    return rawHash;
  }
}

function getSectionFromTargetId(targetId: string): AdminDashboardSectionKey | null {
  if (!targetId) {
    return null;
  }

  if (targetId === 'admin-overview') {
    return 'overview';
  }

  if (targetId === 'admin-statistics') {
    return 'statistics';
  }

  if (targetId === 'admin-sales') {
    return 'sales';
  }

  if (targetId === 'admin-users' || targetId.startsWith('admin-user-')) {
    return 'users';
  }

  if (targetId === 'admin-payments' || targetId.startsWith('admin-payment-')) {
    return 'payments';
  }

  if (targetId === 'admin-subscriptions' || targetId.startsWith('admin-subscription-')) {
    return 'subscriptions';
  }

  if (targetId === 'admin-support' || targetId.startsWith('admin-support-')) {
    return 'support';
  }

  if (targetId === 'admin-audit-logs') {
    return 'audit';
  }

  return null;
}
