import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAdminActionConfirmationDetails,
  getAdminActionConfirmationMessage,
  shouldRunAdminAction,
} from '../app/admin/admin-action-confirmation.ts';

test('admin action confirmation message identifies the risky action and target', () => {
  const message = getAdminActionConfirmationMessage('payment.refund', 'pay_123');

  assert.match(message, /환불 처리/);
  assert.match(message, /pay_123/);
  assert.match(message, /감사 로그/);
});

test('admin action confirmation details provide modal-ready labels', () => {
  const details = getAdminActionConfirmationDetails('admin.user.account.suspend', 'member@example.com');

  assert.equal(details.actionLabel, '계정 정지');
  assert.equal(details.targetLabel, 'member@example.com');
  assert.match(details.title, /관리자 작업 확인/);
  assert.match(details.description, /감사 로그/);
});

test('admin action confirmation blocks the operation when the operator cancels', () => {
  let seenMessage = '';

  const allowed = shouldRunAdminAction('subscription.cancel', 'sub_123', (message) => {
    seenMessage = message;
    return false;
  });

  assert.equal(allowed, false);
  assert.match(seenMessage, /구독 취소 승인/);
  assert.match(seenMessage, /sub_123/);
});

test('admin action confirmation allows the operation when the operator confirms', () => {
  const allowed = shouldRunAdminAction('admin.user.account.suspend', 'member@example.com', () => true);

  assert.equal(allowed, true);
});
