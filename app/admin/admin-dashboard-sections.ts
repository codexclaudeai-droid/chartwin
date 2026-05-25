export type AdminDashboardSectionKey =
  | 'overview'
  | 'webInfo'
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
  children?: Array<{
    label: string;
    href: string;
  }>;
};

const ADMIN_DASHBOARD_SECTION_META: Record<AdminDashboardSectionKey, AdminDashboardSection> = {
  overview: {
    key: 'overview',
    eyebrow: 'Overview',
    label: '운영개요',
    description: '대기 작업과 서비스 상태를 한눈에 확인합니다.',
    href: '#admin-overview',
  },
  users: {
    key: 'users',
    eyebrow: 'Members',
    label: '회원관리',
    description: '회원 상태, 권한, 추천 이력을 확인합니다.',
    href: '#admin-users',
  },
  webInfo: {
    key: 'webInfo',
    eyebrow: 'Web Info',
    label: '웹정보관리',
    description: '회원가입 약관과 개인정보보호정책 문구를 관리합니다.',
    href: '#admin-web-info',
    children: [
      { label: '가입약관', href: '#admin-web-info-terms' },
      { label: '개인정보보호정책', href: '#admin-web-info-privacy' },
      { label: '입금정보관리', href: '#admin-payment-settings' },
      { label: '포인트관리', href: '#admin-point-settings' },
    ],
  },
  support: {
    key: 'support',
    eyebrow: 'Support',
    label: '고객센터',
    description: '문의 게시글과 입금확인 요청에 답변합니다.',
    href: '#admin-support',
  },
  payments: {
    key: 'payments',
    eyebrow: 'Deposits',
    label: '입금확인',
    description: '입금확인 요청과 결제 반려를 수동 처리합니다.',
    href: '#admin-payments',
  },
  subscriptions: {
    key: 'subscriptions',
    eyebrow: 'Subscriptions',
    label: '구독관리',
    description: '입금확인 이후 구독 승인, 환불, 취소를 처리합니다.',
    href: '#admin-subscriptions',
  },
  sales: {
    key: 'sales',
    eyebrow: 'Sales',
    label: '영업관리',
    description: '영업자별 매출, 적립포인트, 개별 정산율을 관리합니다.',
    href: '#admin-sales',
  },
  statistics: {
    key: 'statistics',
    eyebrow: 'Analytics',
    label: '통계',
    description: '매출, 가입자, 방문자 흐름을 일별, 월별, 연도별 차트로 확인합니다.',
    href: '#admin-statistics',
    children: [
      { label: '매출통계', href: '#admin-statistics-sales' },
      { label: '가입자통계', href: '#admin-statistics-signups' },
      { label: '방문자통계', href: '#admin-statistics-visitors' },
    ],
  },
  audit: {
    key: 'audit',
    eyebrow: 'Audit',
    label: '감사로그',
    description: '관리자 조치와 변경 전후 데이터를 추적합니다.',
    href: '#admin-audit-logs',
  },
};

export const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSection[] = [
  ADMIN_DASHBOARD_SECTION_META.overview,
  ADMIN_DASHBOARD_SECTION_META.webInfo,
  ADMIN_DASHBOARD_SECTION_META.users,
  ADMIN_DASHBOARD_SECTION_META.support,
  ADMIN_DASHBOARD_SECTION_META.payments,
  ADMIN_DASHBOARD_SECTION_META.subscriptions,
  ADMIN_DASHBOARD_SECTION_META.sales,
  ADMIN_DASHBOARD_SECTION_META.statistics,
  ADMIN_DASHBOARD_SECTION_META.audit,
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

  if (
    targetId === 'admin-web-info'
    || targetId.startsWith('admin-web-info-')
    || targetId === 'admin-payment-settings'
    || targetId === 'admin-point-settings'
  ) {
    return 'webInfo';
  }

  if (targetId === 'admin-statistics' || targetId.startsWith('admin-statistics-')) {
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
