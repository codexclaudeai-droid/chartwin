import assert from 'node:assert/strict';
import test from 'node:test';

test('notification summary client dedupes badge requests and uses the summary-only API', async () => {
  const {
    clearNotificationSummaryCache,
    getNotificationSummary,
  } = await import('../app/notification-summary-client.ts');
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  try {
    clearNotificationSummaryCache();
    globalThis.fetch = async (url) => {
      requestedUrls.push(String(url));
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({
        ok: true,
        summary: { totalCount: 3, unreadCount: 2 },
      }), { status: 200 });
    };

    const [first, second] = await Promise.all([
      getNotificationSummary(),
      getNotificationSummary(),
    ]);

    assert.equal(requestedUrls.length, 1);
    assert.equal(requestedUrls[0], '/api/notifications?summary=1');
    assert.equal(first.summary?.unreadCount, 2);
    assert.equal(second.summary?.unreadCount, 2);

    const cached = await getNotificationSummary();
    assert.equal(requestedUrls.length, 1);
    assert.equal(cached.summary?.totalCount, 3);
  } finally {
    clearNotificationSummaryCache();
    globalThis.fetch = originalFetch;
  }
});

test('notification summary client can fetch full notifications for realtime voice playback', async () => {
  const {
    clearNotificationSummaryCache,
    getNotificationList,
  } = await import('../app/notification-summary-client.ts');
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  try {
    clearNotificationSummaryCache();
    globalThis.fetch = async (url) => {
      requestedUrls.push(String(url));
      return new Response(JSON.stringify({
        ok: true,
        notifications: [
          {
            id: 'notice_1',
            userId: 'admin_1',
            category: 'subscription',
            title: '구독승인 요청이 접수되었습니다',
            body: 'Trial User <trial@example.com> 결제 확인이 완료되어 구독승인 처리가 필요합니다.',
            linkUrl: '/admin#admin-subscription-sub_1',
            readAt: null,
            archivedAt: null,
            createdAt: '2026-06-15T10:00:00.000Z',
          },
        ],
        summary: { totalCount: 1, unreadCount: 1 },
      }), { status: 200 });
    };

    const result = await getNotificationList({ force: true });

    assert.equal(requestedUrls.length, 1);
    assert.equal(requestedUrls[0], '/api/notifications');
    assert.equal(result.ok, true);
    assert.equal(result.summary?.unreadCount, 1);
    assert.equal(result.notifications[0]?.title, '구독승인 요청이 접수되었습니다');
  } finally {
    clearNotificationSummaryCache();
    globalThis.fetch = originalFetch;
  }
});
