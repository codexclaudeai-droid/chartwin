import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
  formatUserAccountStatusLabel,
  formatUserRoleLabel,
  getAdminPaymentFlowBadge,
  getAdminSubscriptionFlowBadge,
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

test('admin manual flow badges expose the two-step deposit and subscription approval state', () => {
  assert.deepEqual(getAdminPaymentFlowBadge({
    paymentStatus: 'pending',
    subscriptionStatus: 'payment_pending',
  }), {
    label: '입금확인 대기',
    description: '요청글과 실제 입금 내역을 대조하세요.',
    tone: 'waiting',
  });

  assert.deepEqual(getAdminPaymentFlowBadge({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'payment_requested',
  }), {
    label: '입금확인 완료 · 구독승인 대기',
    description: '구독 요청 관리에서 최종 승인을 처리하세요.',
    tone: 'ready',
  });

  assert.deepEqual(getAdminSubscriptionFlowBadge({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'payment_requested',
  }), {
    label: '입금확인 완료 · 구독승인 대기',
    description: '이 단계에서 구독 승인 버튼으로 최종 처리하세요.',
    tone: 'ready',
  });
});

test('admin payment flow badge labels rejected deposits as subscription rejected', () => {
  assert.deepEqual(getAdminPaymentFlowBadge({
    paymentStatus: 'rejected',
    subscriptionStatus: 'payment_pending',
  }), {
    label: '입금미확인/구독반려',
    description: '입금 내역 미확인으로 구독 요청이 반려되었습니다.',
    tone: 'blocked',
  });
});
