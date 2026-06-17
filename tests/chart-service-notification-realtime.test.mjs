import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
} from '../src/server/chart-service/index.ts';
import {
  createNotificationRealtimeStream,
  getNotificationRealtimeSubscriberCount,
  publishNotificationRealtimeEvent,
} from '../src/server/chart-service/notification-realtime.ts';

test('notification realtime streams receive only matching user change events', async () => {
  const stream = createNotificationRealtimeStream('user_member', {
    heartbeatMs: null,
    now: () => '2026-06-17T00:00:00.000Z',
  });
  const reader = stream.getReader();

  try {
    const readyText = await readStreamUntil(reader, /notifications\.ready/);
    assert.match(readyText, /event: notifications\.ready/);
    assert.equal(getNotificationRealtimeSubscriberCount('user_member'), 1);

    assert.equal(publishNotificationRealtimeEvent({
      userId: 'admin_1',
      notificationId: 'notification_admin',
      emittedAt: '2026-06-17T00:00:01.000Z',
    }), 0);
    assert.equal(publishNotificationRealtimeEvent({
      userId: 'user_member',
      notificationId: 'notification_member',
      emittedAt: '2026-06-17T00:00:02.000Z',
    }), 1);

    const changeText = await readStreamUntil(reader, /notification_member/);
    assert.match(changeText, /event: notifications\.changed/);
    assert.match(changeText, /"type":"notifications.changed"/);
    assert.match(changeText, /"notificationId":"notification_member"/);
    assert.doesNotMatch(changeText, /notification_admin/);
  } finally {
    await reader.cancel();
  }

  assert.equal(getNotificationRealtimeSubscriberCount('user_member'), 0);
});

test('async repository notification saves publish realtime change events', async () => {
  const stream = createNotificationRealtimeStream('user_member', {
    heartbeatMs: null,
    now: () => '2026-06-17T00:00:00.000Z',
  });
  const reader = stream.getReader();

  try {
    await readStreamUntil(reader, /notifications\.ready/);
    const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());

    await repository.saveNotification({
      id: 'notification_async',
      userId: 'user_member',
      category: 'payment',
      title: 'Payment received',
      body: 'Payment received',
      linkUrl: '/profile#payment-pay_1',
      readAt: null,
      archivedAt: null,
      createdAt: '2026-06-17T00:00:03.000Z',
    });

    const changeText = await readStreamUntil(reader, /notification_async/);
    assert.match(changeText, /event: notifications\.changed/);
    assert.match(changeText, /"notificationId":"notification_async"/);
  } finally {
    await reader.cancel();
  }
});

async function readStreamUntil(reader, pattern) {
  const decoder = new TextDecoder();
  let text = '';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await readStreamChunk(reader);
    assert.equal(result.done, false);
    text += decoder.decode(result.value);
    if (pattern.test(text)) return text;
  }

  throw new Error(`Timed out waiting for ${pattern}`);
}

async function readStreamChunk(reader) {
  return await Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timed out waiting for notification realtime stream chunk')), 500);
    }),
  ]);
}
