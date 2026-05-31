import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSupportThread,
  createUserNotification,
  getUserDashboardSummary,
} from '../src/server/chart-service/index.ts';

test('user dashboard summarizes account, access, subscription, payments, notifications, and support', () => {
  const repository = createMockChartServiceRepository();
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '확인할 알림',
    body: '마이페이지 요약 테스트',
    createdAt: '2026-05-23T14:00:00.000Z',
  });
  createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '입금 문의',
    body: '입금 확인 부탁드립니다.',
    visibility: 'private',
    createdAt: '2026-05-23T14:01:00.000Z',
  });

  const summary = getUserDashboardSummary(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(summary.user.email, 'member@example.com');
  assert.equal(summary.access.subscriptionStatus, 'payment_pending');
  assert.equal(summary.subscription?.status, 'payment_pending');
  assert.equal(summary.subscriptions.length, 1);
  assert.equal(summary.subscriptions[0].userId, 'user_member');
  assert.equal(summary.payments.length, 1);
  assert.equal(summary.notifications.unreadCount, 1);
  assert.equal(summary.support.visibleThreadCount, 2);
  assert.equal(summary.support.waitingThreadCount, 1);
});

test('dashboard summary never includes another users private support threads or payments', () => {
  const repository = createMockChartServiceRepository();
  createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '타인 비공개 문의',
    body: '다른 사용자는 보면 안 됩니다.',
    visibility: 'private',
    createdAt: '2026-05-23T14:01:00.000Z',
  });

  const summary = getUserDashboardSummary(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
  });

  assert.equal(summary.user.email, 'subscriber@example.com');
  assert.equal(summary.payments.every((payment) => payment.userId === 'user_subscriber'), true);
  assert.equal(summary.support.visibleThreadCount, 1);
});

test('dashboard summary backfills profile metadata for legacy user records', () => {
  const repository = createMockChartServiceRepository();
  const currentUser = repository.getUserById('user_member');
  const {
    phoneNumber: _phoneNumber,
    referralCode: _referralCode,
    referredByUserId: _referredByUserId,
    createdAt: _createdAt,
    ...legacyUser
  } = currentUser;
  repository.saveUser(legacyUser);

  const summary = getUserDashboardSummary(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(summary.user.phoneNumber, null);
  assert.match(summary.user.referralCode, /^[A-Z0-9]{6}$/);
  assert.doesNotMatch(summary.user.referralCode, /^TC-/);
  assert.equal(summary.user.referredByUserId, null);
  assert.equal(summary.user.createdAt, '1970-01-01T00:00:00.000Z');
});

test('dashboard summary upgrades legacy referral codes to the six character format', () => {
  const repository = createMockChartServiceRepository();
  const user = repository.getUserById('user_member');
  repository.saveUser({
    ...user,
    referralCode: 'TC-USERMEMBER',
  });

  const summary = getUserDashboardSummary(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.match(summary.user.referralCode, /^[A-Z0-9]{6}$/);
  assert.equal(repository.getUserById('user_member')?.referralCode, summary.user.referralCode);
});
