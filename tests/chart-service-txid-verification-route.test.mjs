import assert from 'node:assert/strict';
import test from 'node:test';

test('admin TXID verification API checks TronScan and persists the badge status', async () => {
  const {
    createAsyncAuthenticatedManualPaymentRequest,
    createSessionForUser,
    getChartServiceRepository,
    SESSION_COOKIE_NAME,
    updatePaymentTransferSettings,
  } = await import('../src/server/chart-service/index.ts');
  const { POST } = await import('../app/api/admin/payments/verify-txid/route.ts');
  const repository = getChartServiceRepository();
  updatePaymentTransferSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    bankName: 'KB',
    bankAccountNumber: '123',
    bankAccountHolder: 'TC Chart',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-23T09:00:00.000Z',
  });
  const requested = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'usdt',
    requestedAt: '2026-05-23T10:00:00.000Z',
    transactionId: '0xroute123txid',
  });
  const { session } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    hash: '0xroute123txid',
    confirmed: true,
    contractRet: 'SUCCESS',
    trc20TransferInfo: [{
      contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      to_address: 'TXYZ123456789',
      amount_str: '199000000',
      decimals: 6,
      symbol: 'USDT',
    }],
  }), { status: 200 });

  try {
    const response = await POST(new Request('http://localhost/api/admin/payments/verify-txid', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ paymentId: requested.payment.id }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.payment.transactionVerificationStatus, 'verified');
    assert.match(payload.payment.transactionVerificationMessage, /199 USDT/);
    assert.equal(repository.getPaymentById(requested.payment.id)?.transactionVerificationStatus, 'verified');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
