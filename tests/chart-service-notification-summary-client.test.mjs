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
