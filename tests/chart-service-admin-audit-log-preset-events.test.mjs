import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_AUDIT_LOG_PRESET_EVENT,
  dispatchAdminAuditLogPresetEvent,
  subscribeAdminAuditLogPresetEvent,
} from '../app/admin/admin-audit-log-preset-events.ts';

test('admin audit log preset event notifies subscribers and supports cleanup', () => {
  const target = new EventTarget();
  const received = [];
  const unsubscribe = subscribeAdminAuditLogPresetEvent((detail) => {
    received.push(detail);
  }, target);

  dispatchAdminAuditLogPresetEvent({ presetKey: 'all', targetId: 'support_123' }, target);
  unsubscribe();
  dispatchAdminAuditLogPresetEvent({ presetKey: 'payment' }, target);

  assert.equal(ADMIN_AUDIT_LOG_PRESET_EVENT, 'chart-service-admin-audit-log-preset');
  assert.deepEqual(received, [{ presetKey: 'all', targetId: 'support_123' }]);
});

test('admin audit log preset event helpers are safe without a browser target', () => {
  let receivedCount = 0;
  const unsubscribe = subscribeAdminAuditLogPresetEvent(() => {
    receivedCount += 1;
  }, null);

  dispatchAdminAuditLogPresetEvent({ presetKey: 'all' }, null);
  unsubscribe();

  assert.equal(receivedCount, 0);
});
