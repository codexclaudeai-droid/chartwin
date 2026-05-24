import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAdminDashboardPriority,
  getAdminDashboardQueueItems,
} from '../app/admin/admin-dashboard-priority.ts';

function summary(overrides = {}) {
  return {
    payments: {
      totalCount: 0,
      queueCount: 0,
      pendingCount: 0,
      confirmedCount: 0,
      refundedCount: 0,
      rejectedCount: 0,
      ...overrides.payments,
    },
    subscriptions: {
      totalCount: 0,
      queueCount: 0,
      activeCount: 0,
      trialActiveCount: 0,
      paymentPendingCount: 0,
      cancelRequestedCount: 0,
      refundRequestedCount: 0,
      ...overrides.subscriptions,
    },
    support: {
      totalCount: 0,
      waitingCount: 0,
      answeredCount: 0,
      privateCount: 0,
      ...overrides.support,
    },
    users: {
      totalCount: 0,
      activeCount: 0,
      suspendedCount: 0,
      adminCount: 0,
      ...overrides.users,
    },
    audit: {
      totalCount: 0,
      ...overrides.audit,
    },
  };
}

test('admin dashboard priority sends operators to pending payment review first', () => {
  const priority = getAdminDashboardPriority(summary({
    payments: { pendingCount: 2 },
    subscriptions: { queueCount: 3 },
    support: { waitingCount: 4 },
  }));

  assert.deepEqual(priority, {
    key: 'payments',
    title: '입금 확인 대기',
    description: '입금 확인이 필요한 결제 2건을 먼저 확인하세요.',
    href: '#admin-payments',
    panel: 'payments',
    presetKey: 'pending',
    tone: 'urgent',
  });
});

test('admin dashboard priority falls through to subscription and support queues', () => {
  assert.deepEqual(getAdminDashboardPriority(summary({
    subscriptions: { queueCount: 1, refundRequestedCount: 1 },
    support: { waitingCount: 2 },
  })), {
    key: 'subscriptions',
    title: '구독 변경 처리',
    description: '승인, 취소, 환불 검토가 필요한 구독 요청 1건이 있습니다.',
    href: '#admin-subscriptions',
    panel: 'subscriptions',
    presetKey: 'all',
    tone: 'warning',
  });

  assert.deepEqual(getAdminDashboardPriority(summary({
    support: { waitingCount: 2 },
  })), {
    key: 'support',
    title: '고객센터 답변 대기',
    description: '아직 답변하지 않은 고객 문의 2건을 확인하세요.',
    href: '#admin-support',
    panel: 'support',
    presetKey: 'waiting',
    tone: 'warning',
  });
});

test('admin dashboard priority sends operators to suspended account review after live queues', () => {
  assert.deepEqual(getAdminDashboardPriority(summary({
    users: { suspendedCount: 2 },
  })), {
    key: 'users',
    title: '정지 계정 확인',
    description: '정지 상태인 회원 2명을 사용자 관리에서 검토하세요.',
    href: '#admin-users',
    panel: 'users',
    presetKey: 'suspended',
    tone: 'warning',
  });
});

test('admin dashboard calm priority does not dispatch queue preset events', () => {
  const priority = getAdminDashboardPriority(summary());

  assert.equal(priority.key, 'clear');
  assert.equal('panel' in priority, false);
  assert.equal('presetKey' in priority, false);
});

test('admin dashboard queue items list every manual operations queue in priority order', () => {
  const items = getAdminDashboardQueueItems(summary({
    payments: { pendingCount: 2 },
    subscriptions: { queueCount: 3 },
    support: { waitingCount: 4 },
    users: { suspendedCount: 1 },
  }));

  assert.deepEqual(items.map((item) => item.key), ['payments', 'subscriptions', 'support', 'users']);
  assert.deepEqual(items.map((item) => item.href), ['#admin-payments', '#admin-subscriptions', '#admin-support', '#admin-users']);
  assert.deepEqual(items.map((item) => item.countLabel), ['2건', '3건', '4건', '1명']);
  assert.equal(items[0].tone, 'urgent');
  assert.equal(items.every((item) => item.title && item.description), true);
});

test('admin dashboard queue items expose operator action and applied filter labels', () => {
  const items = getAdminDashboardQueueItems(summary({
    payments: { pendingCount: 2 },
    subscriptions: { queueCount: 3 },
    support: { waitingCount: 4 },
    users: { suspendedCount: 1 },
  }));

  assert.deepEqual(items.map((item) => item.actionLabel), [
    '입금 내역 확인 후 승인/반려',
    '취소/환불 요청 검토',
    '대기 문의 답변',
    '정지 사유 검토',
  ]);
  assert.deepEqual(items.map((item) => item.filterLabel), [
    '입금 대기',
    '전체',
    '답변 대기',
    '정지',
  ]);
});

test('admin dashboard queue items are empty when no manual operations are waiting', () => {
  assert.deepEqual(getAdminDashboardQueueItems(summary()), []);
});

test('admin dashboard priority shows a calm state when no manual queue is waiting', () => {
  assert.deepEqual(getAdminDashboardPriority(summary({
    audit: { totalCount: 5 },
  })), {
    key: 'clear',
    title: '대기 중인 운영 작업 없음',
    description: '현재 입금 확인, 구독 변경, 고객 문의 대기 건이 없습니다.',
    href: '#admin-audit-logs',
    tone: 'calm',
  });
});
