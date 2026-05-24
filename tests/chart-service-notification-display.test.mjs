import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('notification display helpers translate categories and action labels', async () => {
  const {
    NOTIFICATION_FILTER_TABS,
    filterNotificationsByTab,
    formatNotificationReadState,
    formatNotificationSummaryMessage,
    getNotificationCategoryLabel,
    getNotificationFilterKeyFromSearch,
    getNotificationLinkLabel,
    getUnreadNotificationsByTab,
  } = await import('../app/notifications/notification-display.ts');

  assert.equal(getNotificationCategoryLabel('support_request'), '신규 문의');
  assert.equal(getNotificationCategoryLabel('support_reply'), '고객센터 답변');
  assert.equal(getNotificationCategoryLabel('payment'), '결제');
  assert.equal(getNotificationCategoryLabel('subscription'), '구독');
  assert.equal(getNotificationCategoryLabel('unknown_category'), 'unknown_category');
  assert.equal(getNotificationLinkLabel({ category: 'support_request', linkUrl: '/admin?supportThread=support_1#admin-support' }), '문의 바로 답변하기');
  assert.equal(getNotificationLinkLabel({ category: 'support_reply', linkUrl: '/support?thread=support_1#support-support_1' }), '문의 답변 확인하기');
  assert.equal(getNotificationLinkLabel({ category: 'payment', linkUrl: '/profile#payment-pay_1' }), '결제 진행 상황 보기');
  assert.equal(getNotificationLinkLabel({ category: 'subscription', linkUrl: '/profile#payment-pay_1' }), '구독 승인 상태 보기');
  assert.equal(getNotificationLinkLabel({ category: 'notice', linkUrl: null }), '관련 화면으로 이동');
  assert.equal(formatNotificationReadState(null), '미확인');
  assert.equal(formatNotificationReadState('2026-05-24T14:00:00.000Z'), '읽음');
  assert.equal(formatNotificationSummaryMessage({ totalCount: 3, unreadCount: 2 }), '전체 알림 3건 중 미확인 알림 2건이 있습니다.');
  assert.deepEqual(
    NOTIFICATION_FILTER_TABS.map((tab) => [tab.key, tab.label]),
    [
      ['all', '전체'],
      ['unread', '미확인'],
      ['support', '문의'],
      ['payment', '결제'],
      ['subscription', '구독'],
    ],
  );
  const notifications = [
    { id: 'n1', category: 'support_request', readAt: null },
    { id: 'n2', category: 'support_reply', readAt: '2026-05-24T14:00:00.000Z' },
    { id: 'n3', category: 'payment', readAt: null },
    { id: 'n4', category: 'subscription', readAt: '2026-05-24T14:01:00.000Z' },
    { id: 'n5', category: 'expiry', readAt: null },
    { id: 'n6', category: 'signal', readAt: null },
  ];
  assert.deepEqual(filterNotificationsByTab(notifications, 'all').map((item) => item.id), ['n1', 'n2', 'n3', 'n4', 'n5', 'n6']);
  assert.deepEqual(filterNotificationsByTab(notifications, 'unread').map((item) => item.id), ['n1', 'n3', 'n5', 'n6']);
  assert.deepEqual(filterNotificationsByTab(notifications, 'support').map((item) => item.id), ['n1', 'n2']);
  assert.deepEqual(filterNotificationsByTab(notifications, 'payment').map((item) => item.id), ['n3']);
  assert.deepEqual(filterNotificationsByTab(notifications, 'subscription').map((item) => item.id), ['n4', 'n5']);
  assert.deepEqual(filterNotificationsByTab(notifications, 'missing').map((item) => item.id), ['n1', 'n2', 'n3', 'n4', 'n5', 'n6']);
  assert.deepEqual(getUnreadNotificationsByTab(notifications, 'all').map((item) => item.id), ['n1', 'n3', 'n5', 'n6']);
  assert.deepEqual(getUnreadNotificationsByTab(notifications, 'support').map((item) => item.id), ['n1']);
  assert.deepEqual(getUnreadNotificationsByTab(notifications, 'subscription').map((item) => item.id), ['n5']);
  assert.equal(getNotificationFilterKeyFromSearch('?tab=payment'), 'payment');
  assert.equal(getNotificationFilterKeyFromSearch('?tab=support&from=nav'), 'support');
  assert.equal(getNotificationFilterKeyFromSearch('?tab=unknown'), 'all');
  assert.equal(getNotificationFilterKeyFromSearch(''), 'all');
});

test('notifications page and panel use readable Korean copy instead of raw notification values', () => {
  const pageSource = fs.readFileSync(new URL('../app/notifications/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/notifications/notifications-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /알림센터/);
  assert.match(pageSource, /운영 처리 결과와 고객센터 답변을 한곳에서 확인합니다/);
  assert.match(panelSource, /getNotificationCategoryLabel/);
  assert.match(panelSource, /getNotificationLinkLabel/);
  assert.match(panelSource, /notification-action-link/);
  assert.match(panelSource, /formatNotificationReadState/);
  assert.match(panelSource, /formatNotificationSummaryMessage/);
  assert.match(panelSource, /NOTIFICATION_FILTER_TABS/);
  assert.match(panelSource, /filterNotificationsByTab/);
  assert.match(panelSource, /activeFilterKey/);
  assert.match(panelSource, /filteredUnreadNotifications/);
  assert.match(panelSource, /getUnreadNotificationsByTab/);
  assert.match(panelSource, /getNotificationFilterKeyFromSearch/);
  assert.match(panelSource, /window\.location\.search/);
  assert.match(panelSource, /window\.history\.pushState/);
  assert.match(panelSource, /popstate/);
  assert.match(panelSource, /applyFilter/);
  assert.match(panelSource, /handleNotificationAction/);
  assert.match(panelSource, /React\.MouseEvent<HTMLAnchorElement>/);
  assert.match(panelSource, /event\.preventDefault\(\)/);
  assert.match(panelSource, /markNotificationRead\(notification\.id, \{ refreshAfter: false \}\)/);
  assert.match(panelSource, /window\.location\.assign\(notification\.linkUrl\)/);
  assert.match(panelSource, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/);
  assert.match(panelSource, /markFilteredRead/);
  assert.match(panelSource, /archiveNotification/);
  assert.match(panelSource, /\/api\/notifications\/\$\{notificationId\}\/archive/);
  assert.match(panelSource, /dispatchNotificationsRefreshEvent/);
  assert.match(panelSource, /현재 필터 읽음/);
  assert.match(panelSource, /Promise\.all/);
  assert.match(panelSource, /notification\.id/);
  assert.match(panelSource, /aria-pressed/);
  assert.match(panelSource, /알림 필터/);
  assert.match(panelSource, /선택한 필터에 해당하는 알림이 없습니다/);
  assert.match(panelSource, /새로고침/);
  assert.match(panelSource, /모두 읽음/);
  assert.doesNotMatch(panelSource, /<span className="badge">\{notification\.category\}<\/span>/);
});
