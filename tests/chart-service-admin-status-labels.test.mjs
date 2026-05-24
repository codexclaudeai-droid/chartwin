import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
  formatUserAccountStatusLabel,
  formatUserRoleLabel,
} from '../app/admin/admin-status-labels.ts';

test('admin status labels translate payment states for operators', () => {
  assert.equal(formatPaymentStatusLabel('pending'), '입금 대기');
  assert.equal(formatPaymentStatusLabel('confirmed'), '입금 확인');
  assert.equal(formatPaymentStatusLabel('refunded'), '환불 완료');
  assert.equal(formatPaymentStatusLabel('rejected'), '반려');
});

test('admin status labels translate subscription request states for operators', () => {
  assert.equal(formatSubscriptionStatusLabel('payment_pending'), '입금 대기');
  assert.equal(formatSubscriptionStatusLabel('payment_requested'), '결제 요청');
  assert.equal(formatSubscriptionStatusLabel('cancel_requested'), '취소 요청');
  assert.equal(formatSubscriptionStatusLabel('refund_requested'), '환불 요청');
  assert.equal(formatSubscriptionStatusLabel('active'), '구독 활성');
});

test('admin status labels translate support thread state and visibility', () => {
  assert.equal(formatSupportStatusLabel('waiting'), '답변 대기');
  assert.equal(formatSupportStatusLabel('answered'), '답변 완료');
  assert.equal(formatSupportVisibilityLabel('private'), '비공개');
  assert.equal(formatSupportVisibilityLabel('public'), '공개');
});

test('admin status labels translate user role and account state', () => {
  assert.equal(formatUserRoleLabel('member'), '회원');
  assert.equal(formatUserRoleLabel('trial'), '체험 회원');
  assert.equal(formatUserRoleLabel('subscriber'), '구독 회원');
  assert.equal(formatUserRoleLabel('salesperson'), '영업');
  assert.equal(formatUserRoleLabel('admin'), '관리자');
  assert.equal(formatUserRoleLabel('super_admin'), '최고관리자');
  assert.equal(formatUserAccountStatusLabel('active'), '정상');
  assert.equal(formatUserAccountStatusLabel('suspended'), '정지');
});

test('admin status labels preserve unknown values for diagnostics', () => {
  assert.equal(formatPaymentStatusLabel('manual_review'), 'manual_review');
  assert.equal(formatSubscriptionStatusLabel('custom_status'), 'custom_status');
  assert.equal(formatSupportStatusLabel('custom_status'), 'custom_status');
  assert.equal(formatSupportVisibilityLabel('internal'), 'internal');
  assert.equal(formatUserRoleLabel('custom_role'), 'custom_role');
  assert.equal(formatUserAccountStatusLabel('locked'), 'locked');
});
