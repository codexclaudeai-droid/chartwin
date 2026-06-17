import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTIFICATIONS_REFRESH_EVENT,
  dispatchNotificationsRefreshEvent,
  subscribeNotificationRealtimeStream,
  subscribeServiceWorkerNotificationsRefreshMessages,
  subscribeNotificationsRefreshEvent,
} from '../app/notification-events.ts';

test('notification refresh event notifies subscribed navigation badges and supports cleanup', () => {
  const target = new EventTarget();
  let refreshCount = 0;
  const unsubscribe = subscribeNotificationsRefreshEvent(() => {
    refreshCount += 1;
  }, target);

  dispatchNotificationsRefreshEvent(target);
  unsubscribe();
  dispatchNotificationsRefreshEvent(target);

  assert.equal(NOTIFICATIONS_REFRESH_EVENT, 'chart-service-notifications-refresh');
  assert.equal(refreshCount, 1);
});

test('notification refresh event helpers are safe without a browser target', () => {
  let refreshCount = 0;
  const unsubscribe = subscribeNotificationsRefreshEvent(() => {
    refreshCount += 1;
  }, null);

  dispatchNotificationsRefreshEvent(null);
  unsubscribe();

  assert.equal(refreshCount, 0);
});

test('service worker notification messages fan out to browser refresh subscribers', () => {
  const serviceWorker = new EventTarget();
  const target = new EventTarget();
  let refreshCount = 0;
  const unsubscribeRefresh = subscribeNotificationsRefreshEvent(() => {
    refreshCount += 1;
  }, target);
  const unsubscribeServiceWorker = subscribeServiceWorkerNotificationsRefreshMessages(serviceWorker, target);

  const matchingMessage = new Event('message');
  Object.defineProperty(matchingMessage, 'data', {
    value: { type: NOTIFICATIONS_REFRESH_EVENT },
  });
  serviceWorker.dispatchEvent(matchingMessage);

  const ignoredMessage = new Event('message');
  Object.defineProperty(ignoredMessage, 'data', {
    value: { type: 'unrelated' },
  });
  serviceWorker.dispatchEvent(ignoredMessage);

  unsubscribeServiceWorker();
  serviceWorker.dispatchEvent(matchingMessage);
  unsubscribeRefresh();

  assert.equal(refreshCount, 1);
});

test('notification realtime stream subscribes to SSE changes and closes on cleanup', () => {
  const eventSource = new FakeEventSource('/api/notifications/stream');
  let refreshCount = 0;
  const unsubscribe = subscribeNotificationRealtimeStream(() => {
    refreshCount += 1;
  }, () => eventSource);

  eventSource.dispatchNamedEvent('notifications.changed', {
    type: 'notifications.changed',
    notificationId: 'notification_1',
  });
  eventSource.dispatchNamedEvent('notifications.ready', {
    type: 'notifications.ready',
  });
  unsubscribe();
  eventSource.dispatchNamedEvent('notifications.changed', {
    type: 'notifications.changed',
    notificationId: 'notification_2',
  });

  assert.equal(eventSource.url, '/api/notifications/stream');
  assert.equal(eventSource.closeCount, 1);
  assert.equal(refreshCount, 1);
});

class FakeEventSource extends EventTarget {
  constructor(url) {
    super();
    this.url = url;
    this.closeCount = 0;
  }

  close() {
    this.closeCount += 1;
  }

  dispatchNamedEvent(type, data) {
    const event = new Event(type);
    Object.defineProperty(event, 'data', {
      value: JSON.stringify(data),
    });
    this.dispatchEvent(event);
  }
}
