import test from 'node:test';
import assert from 'node:assert/strict';

test('mock service creates manual payment requests with a pending subscription', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
    exchangeRate: 1360,
  });

  assert.equal(result.payment.status, 'pending');
  assert.equal(result.subscription.status, 'payment_pending');
  assert.equal(result.payment.amountUsd, 199);
  assert.equal(result.payment.amountKrw, 270640);
});

test('admin can confirm payment and activate subscription through service operation', async () => {
  const {
    confirmManualPaymentAndActivateSubscription,
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const requested = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
  });
  const confirmed = confirmManualPaymentAndActivateSubscription(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
    adminNote: 'bank transfer checked',
  });

  assert.equal(confirmed.payment.status, 'confirmed');
  assert.equal(confirmed.subscription.status, 'active');
  assert.equal(repository.listAuditLogs().length, 1);
});

test('refund operation reverses related referral ledgers', async () => {
  const {
    confirmManualPaymentAndActivateSubscription,
    createMockChartServiceRepository,
    refundManualPaymentAndSubscription,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  confirmManualPaymentAndActivateSubscription(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
  });
  const refunded = refundManualPaymentAndSubscription(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    refundedAt: '2026-05-24T11:00:00.000Z',
    adminNote: 'refund completed',
  });

  assert.equal(refunded.payment.status, 'refunded');
  assert.equal(refunded.subscription.status, 'refunded');
  assert.equal(refunded.reversedReferralCount, 1);
  assert.equal(repository.listReferralLedgersByPaymentId('pay_pending')[0].status, 'reversed');
});

test('chart access snapshot is derived from repository state', async () => {
  const {
    createMockChartServiceRepository,
    getChartAccessSnapshot,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();

  assert.equal(getChartAccessSnapshot(repository, 'user_member').fullChart, false);
  assert.equal(getChartAccessSnapshot(repository, 'user_trial').paidSignals, true);
  assert.equal(getChartAccessSnapshot(repository, 'user_subscriber').fullChart, true);
});
