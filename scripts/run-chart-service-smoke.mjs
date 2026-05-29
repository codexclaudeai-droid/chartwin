import assert from 'node:assert/strict';
import {
  authenticateAsyncUserWithPassword,
  approveAsyncSubscriptionActivationRequest,
  bootstrapAsyncChartServiceRepository,
  confirmAsyncManualPaymentRequest,
  createAsyncAuthenticatedManualPaymentRequest,
  createAsyncChartServiceRepository,
  createAsyncSupportThread,
  createMockChartServiceRepository,
  createMockChartServiceState,
  getAsyncChartAccessSnapshot,
  getAsyncUserDashboardSummary,
  registerAsyncMockUserAccount,
  replyAsyncToSupportThreadAsAdmin,
} from '../src/server/chart-service/index.ts';

const nowIso = '2026-05-26T00:00:00.000Z';
const smokeAdminEmail = 'smoke.admin@example.com';
const smokeAdminPassword = 'SmokeAdmin1234!';

async function main() {
  if ((process.env.CHART_SERVICE_SMOKE_MODE ?? 'memory') !== 'memory') {
    throw new Error('Only CHART_SERVICE_SMOKE_MODE=memory is supported by this smoke harness.');
  }

  const repository = createAsyncChartServiceRepository(
    createMockChartServiceRepository(createMockChartServiceState()),
  );

  await bootstrapAsyncChartServiceRepository(repository, {
    initialAdmin: {
      email: smokeAdminEmail,
      password: smokeAdminPassword,
      name: 'Smoke Admin',
    },
  });
  pass('bootstrap');

  const adminLogin = await authenticateAsyncUserWithPassword(repository, {
    email: smokeAdminEmail,
    password: smokeAdminPassword,
    createdAt: nowIso,
  });
  assert.equal(adminLogin.user.role, 'super_admin');
  const admin = { id: adminLogin.user.id, role: adminLogin.user.role };
  pass('admin login');

  const { user } = await registerAsyncMockUserAccount(repository, {
    email: 'smoke.member@example.com',
    name: 'Smoke Member',
    phoneNumber: '010-5555-7777',
    password: 'Smoke1234!',
    createdAt: nowIso,
  });
  assert.equal(user.email, 'smoke.member@example.com');
  pass('signup');

  const paymentRequest = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: user.id, role: 'member' },
    planId: 'plan_half_year',
    method: 'bank_transfer',
    depositorName: 'Smoke Member',
    exchangeRate: 1500,
    requestedAt: nowIso,
  });
  assert.equal(paymentRequest.payment.status, 'pending');
  assert.equal(paymentRequest.subscription.status, 'payment_pending');
  assert.equal(paymentRequest.supportThread.category, 'deposit');
  pass('payment request');

  const confirmed = await confirmAsyncManualPaymentRequest(repository, {
    paymentId: paymentRequest.payment.id,
    admin,
    confirmedAt: '2026-05-26T00:10:00.000Z',
    adminNote: 'Smoke deposit confirmed.',
  });
  assert.equal(confirmed.payment.status, 'confirmed');
  assert.equal(confirmed.subscription.status, 'payment_requested');
  pass('payment confirmation');

  const activeSubscription = await approveAsyncSubscriptionActivationRequest(repository, {
    subscriptionId: confirmed.subscription.id,
    admin,
    approvedAt: '2026-05-26T00:20:00.000Z',
    adminNote: 'Smoke subscription approved.',
  });
  assert.equal(activeSubscription.status, 'active');

  const access = await getAsyncChartAccessSnapshot(repository, user.id);
  assert.equal(access.fullChart, true);
  assert.equal(access.paidSignals, true);
  pass('subscription approval');

  const support = await createAsyncSupportThread(repository, {
    actor: { id: user.id, role: 'member' },
    category: 'general',
    title: 'Smoke support thread',
    body: 'Smoke support body',
    visibility: 'private',
    createdAt: '2026-05-26T00:30:00.000Z',
  });
  const reply = await replyAsyncToSupportThreadAsAdmin(repository, {
    admin,
    threadId: support.thread.id,
    body: 'Smoke support reply.',
    createdAt: '2026-05-26T00:40:00.000Z',
  });
  assert.equal(reply.thread.status, 'answered');
  pass('support reply');

  const dashboard = await getAsyncUserDashboardSummary(repository, {
    actor: { id: user.id, role: 'member' },
  });
  assert.equal(dashboard.access.fullChart, true);
  assert.equal(dashboard.payments.some((payment) => payment.id === paymentRequest.payment.id), true);
  pass('profile dashboard');

  console.log('Chart service smoke passed.');
}

function pass(label) {
  console.log(`[SMOKE PASS] ${label}`);
}

main().catch((error) => {
  console.error('[SMOKE FAIL]', error instanceof Error ? error.message : error);
  process.exit(1);
});
