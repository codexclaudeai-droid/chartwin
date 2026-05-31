import test from 'node:test';
import assert from 'node:assert/strict';

test('mock service creates manual payment requests with a pending subscription', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = createManualPaymentRequest(repository, {
    userId: 'user_trial',
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

test('bank transfer payment requests require a depositor name', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();

  assert.throws(() => createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: '   ',
    exchangeRate: 1360,
  }), /Bank transfer depositor name required/);
});

test('manual payment request blocks duplicate pending subscription requests', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();

  assert.throws(() => createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
    exchangeRate: 1360,
  }), /이미 구독 신청이 접수되어 처리 중입니다/);
});

test('manual payment request blocks duplicate active subscriptions', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();

  assert.throws(() => createManualPaymentRequest(repository, {
    userId: 'user_subscriber',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Subscriber',
    exchangeRate: 1360,
  }), /이미 구독 중인 플랜이 있습니다/);
});

test('manual payment request blocks a different plan while another plan is pending', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  assert.throws(() => createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_half_year',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
    exchangeRate: 1360,
  }), /이미 구독 신청이 접수되어 처리 중입니다/);
});

test('USDT payment requests store the submitted transaction id for admin review', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  const result = createManualPaymentRequest(repository, {
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '  0xabc123txid  ',
  });

  assert.equal(result.payment.transactionId, '0xabc123txid');
  assert.equal(result.payment.transactionVerificationStatus, 'unchecked');
  assert.equal(result.payment.transactionVerificationMessage, null);
  assert.equal(result.payment.transactionVerifiedAt, null);
  assert.match(result.supportMessage.body, /TXID: 0xabc123txid/);
});

test('admin can verify a USDT TXID against TronScan transfer data', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
    updatePaymentTransferSettings,
    verifyPaymentTransactionPayload,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  updatePaymentTransferSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    bankName: 'KB',
    bankAccountNumber: '123',
    bankAccountHolder: 'TradingCore',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-23T09:00:00.000Z',
  });
  const requested = createManualPaymentRequest(repository, {
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '0xabc123txid',
  });

  const result = verifyPaymentTransactionPayload(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    checkedAt: '2026-05-23T10:10:00.000Z',
    transactionPayload: {
      hash: '0xabc123txid',
      confirmed: true,
      contractRet: 'SUCCESS',
      trc20TransferInfo: [{
        contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to_address: 'TXYZ123456789',
        amount_str: '199000000',
        decimals: 6,
        symbol: 'USDT',
      }],
    },
  });

  assert.equal(result.payment.transactionVerificationStatus, 'verified');
  assert.match(result.payment.transactionVerificationMessage, /199 USDT/);
  assert.equal(result.payment.transactionVerifiedAt, '2026-05-23T10:10:00.000Z');
  assert.equal(repository.getPaymentById(requested.payment.id)?.transactionVerificationStatus, 'verified');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'payment.txid.verify');
});

test('admin TXID verification marks mismatched USDT recipient as mismatch', async () => {
  const {
    createManualPaymentRequest,
    createMockChartServiceRepository,
    updatePaymentTransferSettings,
    verifyPaymentTransactionPayload,
  } = await import('../src/server/chart-service/index.ts');

  const repository = createMockChartServiceRepository();
  updatePaymentTransferSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    bankName: 'KB',
    bankAccountNumber: '123',
    bankAccountHolder: 'TradingCore',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-23T09:00:00.000Z',
  });
  const requested = createManualPaymentRequest(repository, {
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '0xabc123txid',
  });

  const result = verifyPaymentTransactionPayload(repository, {
    paymentId: requested.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    checkedAt: '2026-05-23T10:10:00.000Z',
    transactionPayload: {
      hash: '0xabc123txid',
      confirmed: true,
      contractRet: 'SUCCESS',
      trc20TransferInfo: [{
        contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to_address: 'TWRONGADDRESS',
        amount_str: '199000000',
        decimals: 6,
        symbol: 'USDT',
      }],
    },
  });

  assert.equal(result.payment.transactionVerificationStatus, 'mismatch');
  assert.match(result.payment.transactionVerificationMessage, /recipient/i);
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
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
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
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
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
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T10:00:00.000Z',
    depositorName: 'Member',
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
  assert.equal(refunded.reversedReferralCount, 0);
  assert.equal(repository.listReferralLedgersByPaymentId(requested.payment.id).length, 0);
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
