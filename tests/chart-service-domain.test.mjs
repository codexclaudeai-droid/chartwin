import test from 'node:test';
import assert from 'node:assert/strict';

test('chart service domain exports role and subscription constants', async () => {
  const domain = await import('../src/domain/chart-service/index.ts');

  assert.equal(domain.USER_ROLES.member, 'member');
  assert.equal(domain.SUBSCRIPTION_STATUSES.active, 'active');
});

test('chart access allows trial and subscriber users', async () => {
  const { canUseFullChart, canViewPaidSignals } = await import('../src/domain/chart-service/index.ts');

  assert.equal(canUseFullChart({ role: 'trial', subscriptionStatus: 'trial_active' }), true);
  assert.equal(canUseFullChart({ role: 'subscriber', subscriptionStatus: 'active' }), true);
  assert.equal(canViewPaidSignals({ role: 'subscriber', subscriptionStatus: 'active' }), true);
});

test('chart access blocks member and expired users from paid signals', async () => {
  const { canUseFullChart, canViewPaidSignals } = await import('../src/domain/chart-service/index.ts');

  assert.equal(canUseFullChart({ role: 'member', subscriptionStatus: 'none' }), false);
  assert.equal(canViewPaidSignals({ role: 'subscriber', subscriptionStatus: 'expired' }), false);
  assert.equal(canViewPaidSignals({ role: 'trial', subscriptionStatus: 'trial_expired' }), false);
});

test('admin can approve payment pending subscription', async () => {
  const { approveSubscription, createSubscriptionFixture } = await import('../src/domain/chart-service/index.ts');

  const now = '2026-05-23T08:00:00.000Z';
  const subscription = createSubscriptionFixture({ status: 'payment_pending', planId: 'plan_monthly' });
  const approved = approveSubscription(subscription, {
    adminId: 'admin_1',
    approvedAt: now,
    durationDays: 30,
  });

  assert.equal(approved.status, 'active');
  assert.equal(approved.approvedByAdminId, 'admin_1');
  assert.equal(approved.startsAt, now);
  assert.equal(approved.endsAt, '2026-06-22T08:00:00.000Z');
});

test('subscription approval rejects invalid source status', async () => {
  const { approveSubscription, createSubscriptionFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => approveSubscription(
    createSubscriptionFixture({ status: 'expired' }),
    { adminId: 'admin_1', approvedAt: '2026-05-23T08:00:00.000Z', durationDays: 30 },
  ), /Cannot approve subscription from status expired/);
});

test('admin confirmation marks payment as confirmed', async () => {
  const { confirmPaymentRequest, createPaymentRequestFixture } = await import('../src/domain/chart-service/index.ts');

  const payment = createPaymentRequestFixture({ status: 'pending' });
  const confirmed = confirmPaymentRequest(payment, {
    adminId: 'admin_1',
    confirmedAt: '2026-05-23T09:00:00.000Z',
    adminNote: 'Bank transfer checked',
  });

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.confirmedByAdminId, 'admin_1');
  assert.equal(confirmed.adminNote, 'Bank transfer checked');
});

test('refunding a payment requires confirmed status', async () => {
  const { refundPaymentRequest, createPaymentRequestFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => refundPaymentRequest(
    createPaymentRequestFixture({ status: 'pending' }),
    { adminId: 'admin_1', refundedAt: '2026-05-23T09:00:00.000Z', adminNote: 'duplicate' },
  ), /Cannot refund payment from status pending/);
});

test('referral points confirm after refund window', async () => {
  const { confirmReferralLedger, createReferralLedgerFixture } = await import('../src/domain/chart-service/index.ts');

  const ledger = createReferralLedgerFixture({
    status: 'pending',
    confirmAfter: '2026-05-30T00:00:00.000Z',
  });
  const confirmed = confirmReferralLedger(ledger, '2026-05-31T00:00:00.000Z');

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.confirmedAt, '2026-05-31T00:00:00.000Z');
});

test('referral points do not confirm before refund window', async () => {
  const { confirmReferralLedger, createReferralLedgerFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => confirmReferralLedger(
    createReferralLedgerFixture({ confirmAfter: '2026-05-30T00:00:00.000Z' }),
    '2026-05-29T23:59:59.000Z',
  ), /Cannot confirm referral ledger before confirmAfter/);
});

test('manual admin flow confirms payment, activates subscription, and later reverses referral on refund', async () => {
  const {
    approveSubscription,
    confirmPaymentRequest,
    createPaymentRequestFixture,
    createReferralLedgerFixture,
    createSubscriptionFixture,
    refundPaymentRequest,
    refundSubscription,
    reverseReferralLedger,
  } = await import('../src/domain/chart-service/index.ts');

  const payment = createPaymentRequestFixture({ status: 'pending' });
  const subscription = createSubscriptionFixture({ status: 'payment_pending', planId: 'plan_monthly' });
  const ledger = createReferralLedgerFixture({ status: 'pending' });

  const confirmedPayment = confirmPaymentRequest(payment, {
    adminId: 'admin_1',
    confirmedAt: '2026-05-23T09:00:00.000Z',
    adminNote: 'manual bank transfer confirmed',
  });
  const activeSubscription = approveSubscription(subscription, {
    adminId: 'admin_1',
    approvedAt: '2026-05-23T09:00:00.000Z',
    durationDays: 30,
  });

  assert.equal(confirmedPayment.status, 'confirmed');
  assert.equal(activeSubscription.status, 'active');

  const refundedPayment = refundPaymentRequest(confirmedPayment, {
    adminId: 'admin_1',
    refundedAt: '2026-05-25T09:00:00.000Z',
    adminNote: 'customer refund completed',
  });
  const refundedSubscription = refundSubscription(activeSubscription, {
    adminId: 'admin_1',
    refundedAt: '2026-05-25T09:00:00.000Z',
  });
  const reversedLedger = reverseReferralLedger(ledger, '2026-05-25T09:00:00.000Z');

  assert.equal(refundedPayment.status, 'refunded');
  assert.equal(refundedSubscription.status, 'refunded');
  assert.equal(reversedLedger.status, 'reversed');
});

test('dashboard presentation helpers format user-facing account status labels', async () => {
  const {
    formatChartAccessLabel,
    formatPaymentAmountUsd,
    formatPaymentStatusLabel,
    formatSubscriptionStatusLabel,
  } = await import('../src/domain/chart-service/index.ts');

  assert.equal(formatSubscriptionStatusLabel('payment_pending'), '입금 확인 대기');
  assert.equal(formatSubscriptionStatusLabel('active'), '구독 활성');
  assert.equal(formatSubscriptionStatusLabel('refund_requested'), '환불 승인 대기');
  assert.equal(formatPaymentStatusLabel('confirmed'), '입금 확인 완료');
  assert.equal(formatPaymentStatusLabel('refunded'), '환불 완료');
  assert.equal(formatChartAccessLabel({ fullChart: true, paidSignals: true }), 'TC Chart와 유료 시그널 이용 가능');
  assert.equal(formatChartAccessLabel({ fullChart: true, paidSignals: false }), 'TC Chart 이용 가능, 유료 시그널 승인 대기');
  assert.equal(formatChartAccessLabel({ fullChart: false, paidSignals: false }), '구독 승인 후 이용 가능');
  assert.equal(formatPaymentAmountUsd(49.9), '$49.90');
});
