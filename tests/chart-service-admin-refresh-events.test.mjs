import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_REFRESH_EVENT,
  dispatchAdminRefreshEvent,
  subscribeAdminRefreshEvent,
} from '../app/admin/admin-refresh-events.ts';

test('admin refresh event notifies subscribed panels and supports cleanup', () => {
  const target = new EventTarget();
  let refreshCount = 0;
  const unsubscribe = subscribeAdminRefreshEvent(() => {
    refreshCount += 1;
  }, target);

  dispatchAdminRefreshEvent(target);
  unsubscribe();
  dispatchAdminRefreshEvent(target);

  assert.equal(ADMIN_REFRESH_EVENT, 'chart-service-admin-refresh');
  assert.equal(refreshCount, 1);
});

test('admin refresh event carries the source panel for self-refresh guards', () => {
  const target = new EventTarget();
  let receivedDetail = null;
  const unsubscribe = subscribeAdminRefreshEvent((detail) => {
    receivedDetail = detail;
  }, target);

  dispatchAdminRefreshEvent({ source: 'payments' }, target);
  unsubscribe();

  assert.deepEqual(receivedDetail, { source: 'payments' });
});

test('admin refresh event supports web info source changes', () => {
  const target = new EventTarget();
  let receivedDetail = null;
  const unsubscribe = subscribeAdminRefreshEvent((detail) => {
    receivedDetail = detail;
  }, target);

  dispatchAdminRefreshEvent({ source: 'webInfo' }, target);
  unsubscribe();

  assert.deepEqual(receivedDetail, { source: 'webInfo' });
});

test('admin refresh event helpers are safe without a browser target', () => {
  let refreshCount = 0;
  const unsubscribe = subscribeAdminRefreshEvent(() => {
    refreshCount += 1;
  }, null);

  dispatchAdminRefreshEvent(null);
  unsubscribe();

  assert.equal(refreshCount, 0);
});
