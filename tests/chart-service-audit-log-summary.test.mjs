import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAuditLogSummary } from '../app/admin/audit-log-summary.ts';

test('audit log summary highlights payment and subscription status changes', () => {
  const summary = formatAuditLogSummary({
    action: 'payment.confirm_and_subscription.activate',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: {
      payment: { status: 'pending' },
      subscription: { status: 'payment_pending' },
    },
    afterJson: {
      payment: { status: 'confirmed', adminNote: '입금 확인 완료' },
      subscription: { status: 'active' },
    },
  });

  assert.deepEqual(summary, [
    '결제 상태: 입금 대기 -> 입금 확인',
    '구독 상태: 입금 대기 -> 구독 활성',
    '관리자 메모: 입금 확인 완료',
  ]);
});

test('audit log summary highlights user account changes and reasons', () => {
  const summary = formatAuditLogSummary({
    action: 'admin.user.account.suspend',
    targetType: 'user',
    targetId: 'user_member',
    beforeJson: {
      user: { role: 'member', accountStatus: 'active' },
    },
    afterJson: {
      user: { role: 'member', accountStatus: 'suspended' },
      reason: '중복 결제 악용 확인',
    },
  });

  assert.deepEqual(summary, [
    '계정 상태: 정상 -> 정지',
    '처리 사유: 중복 결제 악용 확인',
  ]);
});

test('audit log summary translates user role and support status changes', () => {
  const summary = formatAuditLogSummary({
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: 'user_member',
    beforeJson: {
      user: { role: 'member' },
      thread: { status: 'waiting' },
    },
    afterJson: {
      user: { role: 'salesperson' },
      thread: { status: 'answered' },
    },
  });

  assert.deepEqual(summary, [
    '회원 역할: 회원 -> 영업',
    '문의 상태: 답변 대기 -> 답변 완료',
  ]);
});

test('audit log summary preserves unknown values for diagnostics', () => {
  const summary = formatAuditLogSummary({
    action: 'audit.custom',
    targetType: 'custom',
    targetId: 'custom_1',
    beforeJson: {
      payment: { status: 'manual_review' },
    },
    afterJson: {
      payment: { status: 'custom_done' },
    },
  });

  assert.deepEqual(summary, [
    '결제 상태: manual_review -> custom_done',
  ]);
});

test('audit log summary falls back when no known change can be summarized', () => {
  const summary = formatAuditLogSummary({
    action: 'audit.unknown',
    targetType: 'unknown',
    targetId: 'unknown_1',
    beforeJson: {},
    afterJson: {},
  });

  assert.deepEqual(summary, ['상세 변경은 원본 JSON에서 확인하세요.']);
});

test('audit log summary highlights web info and plan service changes', () => {
  const summary = formatAuditLogSummary({
    action: 'admin.web_info.settings.update',
    targetType: 'web_info_settings',
    targetId: 'default',
    beforeJson: {
      settings: {
        termsContent: 'Old terms',
        privacyContent: 'Old privacy',
        planServices: {
          plan_monthly: ['TC Chart 접근'],
          plan_half_year: ['TC Chart 접근', '유료 시그널 열람'],
        },
      },
    },
    afterJson: {
      settings: {
        termsContent: 'New terms',
        privacyContent: 'Old privacy',
        planServices: {
          plan_monthly: ['TC Chart 접근', '유료 시그널 열람'],
          plan_half_year: ['TC Chart 접근', '유료 시그널 열람'],
        },
      },
    },
  });

  assert.deepEqual(summary, [
    '가입약관 내용 변경',
    '플랜 제공서비스 변경: 1개 플랜',
  ]);
});
