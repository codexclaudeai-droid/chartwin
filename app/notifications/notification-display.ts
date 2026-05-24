type NotificationDisplayInput = {
  category: string;
  linkUrl: string | null;
};

type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

type FilterableNotification = {
  category: string;
  readAt: string | null;
};

export type NotificationFilterKey = 'all' | 'unread' | 'support' | 'payment' | 'subscription';

export const NOTIFICATION_FILTER_TABS: Array<{ key: NotificationFilterKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '미확인' },
  { key: 'support', label: '문의' },
  { key: 'payment', label: '결제' },
  { key: 'subscription', label: '구독' },
];

const CATEGORY_LABELS: Record<string, string> = {
  support_request: '신규 문의',
  support_reply: '고객센터 답변',
  qna: '문의',
  subscription: '구독',
  payment: '결제',
  signal: '시그널',
  expiry: '만료 예정',
  notice: '공지',
};

export function getNotificationCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function filterNotificationsByTab<T extends FilterableNotification>(
  notifications: T[],
  filterKey: string,
): T[] {
  if (filterKey === 'unread') return notifications.filter((notification) => !notification.readAt);
  if (filterKey === 'support') {
    return notifications.filter((notification) => (
      notification.category === 'support_request' ||
      notification.category === 'support_reply' ||
      notification.category === 'qna'
    ));
  }
  if (filterKey === 'payment') {
    return notifications.filter((notification) => notification.category === 'payment');
  }
  if (filterKey === 'subscription') {
    return notifications.filter((notification) => (
      notification.category === 'subscription' ||
      notification.category === 'expiry'
    ));
  }
  return notifications;
}

export function getNotificationLinkLabel(notification: NotificationDisplayInput): string {
  if (notification.category === 'support_request') return '문의 바로 답변하기';
  if (notification.category === 'support_reply') return '답변 확인하기';
  if (notification.category === 'payment' || notification.category === 'subscription') {
    return '결제/구독 화면으로 이동';
  }
  if (notification.category === 'signal') return '시그널 확인하기';
  if (notification.category === 'expiry') return '구독 갱신 확인하기';
  return '관련 화면으로 이동';
}

export function formatNotificationReadState(readAt: string | null): string {
  return readAt ? '읽음' : '미확인';
}

export function formatNotificationSummaryMessage(summary: NotificationSummary): string {
  return `전체 알림 ${summary.totalCount}건 중 미확인 알림 ${summary.unreadCount}건이 있습니다.`;
}
