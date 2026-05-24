import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTIFICATIONS_REFRESH_EVENT,
  dispatchNotificationsRefreshEvent,
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
