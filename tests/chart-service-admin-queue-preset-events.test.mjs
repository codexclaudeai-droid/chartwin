import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_QUEUE_PRESET_EVENT,
  dispatchAdminQueuePresetEvent,
  subscribeAdminQueuePresetEvent,
} from '../app/admin/admin-queue-preset-events.ts';

test('admin queue preset event notifies subscribers with panel and preset detail', () => {
  const target = new EventTarget();
  const received = [];
  const unsubscribe = subscribeAdminQueuePresetEvent((detail) => {
    received.push(detail);
  }, target);

  dispatchAdminQueuePresetEvent({ panel: 'payments', presetKey: 'pending' }, target);
  unsubscribe();
  dispatchAdminQueuePresetEvent({ panel: 'support', presetKey: 'waiting' }, target);

  assert.equal(ADMIN_QUEUE_PRESET_EVENT, 'chart-service-admin-queue-preset');
  assert.deepEqual(received, [{ panel: 'payments', presetKey: 'pending' }]);
});

test('admin queue preset event helpers are safe without a browser target', () => {
  let receivedCount = 0;
  const unsubscribe = subscribeAdminQueuePresetEvent(() => {
    receivedCount += 1;
  }, null);

  dispatchAdminQueuePresetEvent({ panel: 'payments', presetKey: 'pending' }, null);
  unsubscribe();

  assert.equal(receivedCount, 0);
});
