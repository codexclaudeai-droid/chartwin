import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('notification display helpers translate categories and action labels', async () => {
  const {
    formatNotificationReadState,
    formatNotificationSummaryMessage,
    getNotificationCategoryLabel,
    getNotificationLinkLabel,
  } = await import('../app/notifications/notification-display.ts');

  assert.equal(getNotificationCategoryLabel('support_request'), '신규 문의');
  assert.equal(getNotificationCategoryLabel('support_reply'), '고객센터 답변');
  assert.equal(getNotificationCategoryLabel('payment'), '결제');
  assert.equal(getNotificationCategoryLabel('subscription'), '구독');
  assert.equal(getNotificationCategoryLabel('unknown_category'), 'unknown_category');
  assert.equal(getNotificationLinkLabel({ category: 'support_request', linkUrl: '/admin?supportThread=support_1#admin-support' }), '문의 바로 답변하기');
  assert.equal(getNotificationLinkLabel({ category: 'support_reply', linkUrl: '/support' }), '답변 확인하기');
  assert.equal(getNotificationLinkLabel({ category: 'payment', linkUrl: '/pricing' }), '결제/구독 화면으로 이동');
  assert.equal(getNotificationLinkLabel({ category: 'notice', linkUrl: null }), '관련 화면으로 이동');
  assert.equal(formatNotificationReadState(null), '미확인');
  assert.equal(formatNotificationReadState('2026-05-24T14:00:00.000Z'), '읽음');
  assert.equal(formatNotificationSummaryMessage({ totalCount: 3, unreadCount: 2 }), '전체 알림 3건 중 미확인 알림 2건이 있습니다.');
});

test('notifications page and panel use readable Korean copy instead of raw notification values', () => {
  const pageSource = fs.readFileSync(new URL('../app/notifications/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/notifications/notifications-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /알림센터/);
  assert.match(pageSource, /운영 처리 결과와 고객센터 답변을 한곳에서 확인합니다/);
  assert.match(panelSource, /getNotificationCategoryLabel/);
  assert.match(panelSource, /getNotificationLinkLabel/);
  assert.match(panelSource, /formatNotificationReadState/);
  assert.match(panelSource, /formatNotificationSummaryMessage/);
  assert.match(panelSource, /새로고침/);
  assert.match(panelSource, /모두 읽음/);
  assert.doesNotMatch(panelSource, /<span className="badge">\{notification\.category\}<\/span>/);
});
