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

type ReadableNotification = {
  id: string;
  readAt: string | null;
};

type IdentifiableNotification = {
  id: string;
};

export type NotificationFilterKey = 'all' | 'unread' | 'support' | 'payment' | 'subscription';

export const NOTIFICATION_FILTER_TABS: Array<{ key: NotificationFilterKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '미확인' },
  { key: 'support', label: '문의' },
  { key: 'payment', label: '결제' },
  { key: 'subscription', label: '구독' },
];

const EMPTY_STATE_MESSAGES: Record<NotificationFilterKey, string> = {
  all: '아직 알림이 없습니다. 결제 요청, 구독 승인, 고객센터 답변이 생기면 여기에 표시됩니다.',
  unread: '미확인 알림이 없습니다. 전체 탭에서 읽은 알림을 다시 확인할 수 있습니다.',
  support: '문의 알림이 없습니다. 고객센터 답변이나 새 문의 알림이 생기면 표시됩니다.',
  payment: '결제 알림이 없습니다. 입금확인 요청이나 관리자 처리 결과가 생기면 표시됩니다.',
  subscription: '구독 알림이 없습니다. 승인, 만료 예정, 취소/환불 처리 결과가 생기면 표시됩니다.',
};

const FILTER_HELP_MESSAGES: Partial<Record<NotificationFilterKey, string>> = {
  unread: '고객센터 답변 알림은 미확인 탭에 표시됩니다. 알림의 "문의 답변 확인하기"를 누르면 해당 문의 카드로 이동합니다.',
  support: '문의 탭에서는 고객센터 답변과 문의 관련 알림만 모아봅니다. "문의 답변 확인하기"를 누르면 답변이 달린 문의로 이동합니다.',
};

export function getNotificationFilterKeyFromSearch(search: string): NotificationFilterKey {
  const params = new URLSearchParams(search);
  const filterKey = params.get('tab');
  const matchedTab = NOTIFICATION_FILTER_TABS.find((tab) => tab.key === filterKey);

  return matchedTab?.key ?? 'all';
}

export function getNotificationEmptyStateMessage(
  filterKey: NotificationFilterKey,
  hasAnyNotifications: boolean,
): string {
  if (!hasAnyNotifications) return EMPTY_STATE_MESSAGES.all;

  return EMPTY_STATE_MESSAGES[filterKey];
}

export function getNotificationFilterHelpMessage(filterKey: NotificationFilterKey): string | null {
  return FILTER_HELP_MESSAGES[filterKey] ?? null;
}

export function getNotificationBulkActionHint(
  summary: NotificationSummary,
  filterKey: NotificationFilterKey,
  filteredUnreadCount: number,
): string | null {
  if (summary.unreadCount === 0) {
    return '미확인 알림이 없어 읽음 처리 버튼이 비활성화되었습니다.';
  }
  if (filterKey !== 'all' && filteredUnreadCount === 0) {
    return '현재 필터에 미확인 알림이 없어 필터 읽음 버튼이 비활성화되었습니다.';
  }

  return null;
}

export function getNotificationCenterHref(unreadCount: number): string {
  return unreadCount > 0 ? '/notifications?tab=unread' : '/notifications';
}

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

const LEGACY_SUPPORT_REPLY_TITLE = String.fromCodePoint(
  0x6028, 0xc889, 0xcefc, 0x3f, 0xc1f3, 0xaf63, 0x20, 0x3f,
  0xb4ec, 0x3f, 0x3f, 0x3f, 0x3f, 0xae45, 0xc909, 0x3f,
  0xc10f, 0xbfc0, 0x3f, 0xb4ec, 0xb572, 0x3f, 0x3f,
);

const LEGACY_MOJIBAKE_TITLES = new Map<string, string>([
  [LEGACY_SUPPORT_REPLY_TITLE, '고객센터 답변이 등록되었습니다'],
]);

export function normalizeNotificationTitle(title: string): string {
  return LEGACY_MOJIBAKE_TITLES.get(title) ?? title;
}

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

export function getUnreadNotificationsByTab<T extends FilterableNotification>(
  notifications: T[],
  filterKey: string,
): T[] {
  return filterNotificationsByTab(notifications, filterKey)
    .filter((notification) => !notification.readAt);
}

export function getNotificationsWithReadState<T extends ReadableNotification>(
  notifications: T[],
  notificationIds: string[],
  readAt: string,
): T[] {
  const notificationIdSet = new Set(notificationIds);

  return notifications.map((notification) => {
    if (!notificationIdSet.has(notification.id) || notification.readAt) return notification;

    return {
      ...notification,
      readAt,
    };
  });
}

export function getNotificationsWithoutIds<T extends IdentifiableNotification>(
  notifications: T[],
  notificationIds: string[],
): T[] {
  const notificationIdSet = new Set(notificationIds);

  return notifications.filter((notification) => !notificationIdSet.has(notification.id));
}

export function getNotificationSummaryFromList<T extends ReadableNotification>(
  notifications: T[],
): NotificationSummary {
  return {
    totalCount: notifications.length,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  };
}

export function getNotificationLinkLabel(notification: NotificationDisplayInput): string {
  if (notification.category === 'support_request') return '문의 바로 답변하기';
  if (notification.category === 'support_reply') return '문의 답변 확인하기';
  if (notification.category === 'payment') return '결제 진행 상황 보기';
  if (notification.category === 'subscription') return '구독 승인 상태 보기';
  if (notification.category === 'signal') return '시그널 확인하기';
  if (notification.category === 'expiry') return '구독 갱신 확인하기';
  return '관련 화면으로 이동';
}

export function getNotificationNavigationMessage(notification: NotificationDisplayInput): string {
  if (notification.category === 'support_request') return '신규 문의 알림을 읽음 처리하고 답변 화면으로 이동합니다.';
  if (notification.category === 'support_reply') return '고객센터 답변을 읽음 처리하고 문의로 이동합니다.';
  if (notification.category === 'payment') return '결제 알림을 읽음 처리하고 진행 상황으로 이동합니다.';
  if (notification.category === 'subscription') return '구독 알림을 읽음 처리하고 승인 상태로 이동합니다.';
  if (notification.category === 'signal') return '시그널 알림을 읽음 처리하고 차트로 이동합니다.';
  if (notification.category === 'expiry') return '만료 예정 알림을 읽음 처리하고 갱신 화면으로 이동합니다.';
  return '알림을 읽음 처리합니다.';
}

export function formatNotificationReadState(readAt: string | null): string {
  return readAt ? '읽음' : '미확인';
}

export function formatNotificationSummaryMessage(summary: NotificationSummary): string {
  return `전체 알림 ${summary.totalCount}건 중 미확인 알림 ${summary.unreadCount}건이 있습니다.`;
}
