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

test('USDT payment requests store the submitted transaction id for admin review', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '  0xabc123txid  ',
  });

  assert.equal(result.payment.transactionId, '0xabc123txid');
  assert.match(result.supportMessage.body, /TXID: 0xabc123txid/);
});

test('USDT payment requests require a transaction id', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();

  assert.throws(() => createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '   ',
  }), /USDT transaction id required/);
});

test('admin can confirm payment without activating subscription', async () => {
  const {
    confirmManualPaymentRequest,
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
  const confirmed = confirmManualPaymentRequest(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
    adminNote: 'bank transfer checked',
  });

  assert.equal(confirmed.payment.status, 'confirmed');
  assert.equal(confirmed.subscription.status, 'payment_requested');
  assert.equal(confirmed.subscription.startsAt, null);
  assert.equal(confirmed.subscription.approvedAt, null);
  assert.equal(repository.listAuditLogs().length, 1);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'payment.confirm');
});

test('admin can approve a confirmed payment subscription separately', async () => {
  const {
    approveSubscriptionActivationRequest,
    confirmManualPaymentRequest,
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
  const confirmed = confirmManualPaymentRequest(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
  });

  const approved = approveSubscriptionActivationRequest(repository, {
    subscriptionId: confirmed.subscription.id,
    admin: { id: 'admin_1', role: 'admin' },
    approvedAt: '2026-05-23T11:05:00.000Z',
    adminNote: 'subscription access approved',
  });

  assert.equal(approved.status, 'active');
  assert.equal(approved.approvedByAdminId, 'admin_1');
  assert.equal(approved.startsAt, '2026-05-23T11:05:00.000Z');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'subscription.activate.approve');
});

test('admin can refund a confirmed payment before subscription activation', async () => {
  const {
    confirmManualPaymentRequest,
    createManualPaymentRequest,
    createMockChartServiceRepository,
    refundManualPaymentAndSubscription,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const requested = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
  });
  confirmManualPaymentRequest(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
  });

  const refunded = refundManualPaymentAndSubscription(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    refundedAt: '2026-05-23T11:30:00.000Z',
    adminNote: 'customer requested refund before activation',
  });

  assert.equal(refunded.payment.status, 'refunded');
  assert.equal(refunded.subscription.status, 'refunded');
  assert.equal(refunded.subscription.startsAt, null);
  assert.equal(refunded.reversedReferralCount, 1);
  assert.equal(repository.listReferralLedgersByPaymentId(requested.payment.id)[0].status, 'reversed');
});

test('refund operation reverses related referral ledgers', async () => {
  const {
    approveSubscriptionActivationRequest,
    confirmManualPaymentRequest,
    createMockChartServiceRepository,
    refundManualPaymentAndSubscription,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const confirmed = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T11:00:00.000Z',
  });
  approveSubscriptionActivationRequest(repository, {
    subscriptionId: confirmed.subscription.id,
    admin: { id: 'admin_1', role: 'admin' },
    approvedAt: '2026-05-23T11:05:00.000Z',
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
