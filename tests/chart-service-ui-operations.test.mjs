import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  createAuthenticatedManualPaymentRequest,
  createMockChartServiceRepository,
  listAdminPaymentQueue,
  rejectManualPaymentRequest,
} from '../src/server/chart-service/index.ts';

test('authenticated payment request uses the actor user id instead of trusting client supplied user ids', () => {
  const repository = createMockChartServiceRepository();

  const result = createAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T09:00:00.000Z',
    depositorName: 'Trial User',
  });

  assert.equal(result.payment.userId, 'user_trial');
  assert.equal(result.subscription.userId, 'user_trial');
  assert.equal(result.payment.status, 'pending');
  assert.equal(result.subscription.status, 'payment_pending');
});

test('authenticated payment request creates a private deposit support thread', () => {
  const repository = createMockChartServiceRepository();

  const result = createAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T09:00:00.000Z',
    depositorName: 'Trial User',
  });

  assert.equal(result.payment.supportThreadId, result.supportThread.id);
  assert.equal(result.supportThread.category, 'deposit');
  assert.equal(result.supportThread.visibility, 'private');
  assert.equal(result.supportThread.status, 'waiting');
  assert.equal(result.supportMessage.threadId, result.supportThread.id);
  assert.equal(result.supportMessage.isAdminReply, false);
  assert.match(result.supportMessage.body, new RegExp(result.payment.id));
  assert.match(result.supportMessage.body, /Trial User/);
  assert.match(result.supportMessage.body, /Monthly/);
  assert.match(result.supportMessage.body, /관리자가 실제 입금 내역을 수동 확인/);
});

test('admin payment queue joins payment, user, plan, and subscription status for operations UI', () => {
  const repository = createMockChartServiceRepository();

  const queue = listAdminPaymentQueue(repository);
  const pending = queue.find((item) => item.payment.id === 'pay_pending');

  assert.ok(pending);
  assert.equal(pending.user.email, 'member@example.com');
  assert.equal(pending.plan?.name, 'Monthly');
  assert.equal(pending.subscription?.status, 'payment_pending');
});

test('admin payment queue includes the linked deposit support thread', () => {
  const repository = createMockChartServiceRepository();
  const result = createAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T09:00:00.000Z',
    depositorName: 'Trial User',
  });

  const queueItem = listAdminPaymentQueue(repository)
    .find((item) => item.payment.id === result.payment.id);

  assert.equal(queueItem?.supportThread?.id, result.supportThread.id);
  assert.equal(queueItem?.supportThread?.category, 'deposit');
});

test('admin payment confirmation leaves subscription approval for the subscription queue', async () => {
  const {
    confirmManualPaymentRequest,
  } = await import('../src/server/chart-service/index.ts');
  const repository = createMockChartServiceRepository();

  const result = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T12:10:00.000Z',
    adminNote: '입금 확인',
  });
  const paymentQueueItem = listAdminPaymentQueue(repository)
    .find((item) => item.payment.id === 'pay_pending');

  assert.equal(result.payment.status, 'confirmed');
  assert.equal(result.subscription.status, 'payment_requested');
  assert.equal(paymentQueueItem?.subscription?.status, 'payment_requested');
});

test('admin payment queue API does not expose user password hashes', async () => {
  const {
    createSessionForUser,
    getChartServiceRepository,
    SESSION_COOKIE_NAME,
  } = await import('../src/server/chart-service/index.ts');
  const repository = getChartServiceRepository();
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET } = await import('../app/api/admin/payments/route.ts');

  const response = await GET(new Request('http://localhost/api/admin/payments', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.payments[0].user.passwordHash, undefined);
});

test('admin can reject a pending payment request and cancel its pending subscription', () => {
  const repository = createMockChartServiceRepository();

  const result = rejectManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T12:20:00.000Z',
    adminNote: '입금 내역을 확인할 수 없습니다.',
  });

  assert.equal(result.payment.status, 'rejected');
  assert.equal(result.subscription.status, 'cancelled');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'payment.reject_and_subscription.cancel');
});

test('payment rejection requires an explicit admin note', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => rejectManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T12:20:00.000Z',
    adminNote: '   ',
  }), /Admin note required/);

  assert.equal(repository.getPaymentById('pay_pending')?.status, 'pending');
  assert.equal(repository.getSubscriptionById('sub_pending')?.status, 'payment_pending');
  assert.equal(repository.listAuditLogs().length, 0);
});

test('payment reject API does not inject a hidden default admin note', async () => {
  const {
    createSessionForUser,
    getChartServiceRepository,
    SESSION_COOKIE_NAME,
  } = await import('../src/server/chart-service/index.ts');
  const { POST } = await import('../app/api/admin/payments/reject/route.ts');
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });

  const response = await POST(new Request('http://localhost/api/admin/payments/reject', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ paymentId: 'pay_pending', adminNote: '   ' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.message, /Admin note required/);
});

test('admin payment panel renders status quick filters before the table', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /PAYMENT_QUEUE_FILTER_PRESETS/);
  assert.match(source, /aria-label="결제 요청 빠른 필터"/);
  assert.match(source, /filteredPayments\.map/);
});

test('admin payment panel applies dashboard queue preset events', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /subscribeAdminQueuePresetEvent/);
  assert.match(source, /detail\.panel !== 'payments'/);
  assert.match(source, /const dashboardFilter = getPaymentQueueFilterPreset\(detail\.presetKey\)/);
  assert.match(source, /setActiveFilterKey\(dashboardFilter\.key\)/);
});

test('admin payment panel renders operator-friendly payment status labels', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatPaymentStatusLabel/);
});

test('admin operation panels render strengthened manual flow badges', () => {
  const paymentSource = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const subscriptionSource = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');
  const labelSource = fs.readFileSync(new URL('../app/admin/admin-status-labels.ts', import.meta.url), 'utf8');

  assert.match(paymentSource, /getAdminPaymentFlowBadge/);
  assert.match(subscriptionSource, /getAdminSubscriptionFlowBadge/);
  assert.match(paymentSource, /manual-flow-badge/);
  assert.match(subscriptionSource, /manual-flow-description/);
  assert.match(labelSource, /입금확인 완료 · 구독승인 대기/);
});

test('admin payment panel confirms irreversible payment operations before posting', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useAdminActionConfirmation/);
  assert.match(source, /await confirmAdminAction/);
  assert.match(source, /\{confirmationDialog\}/);
  assert.match(source, /`payment\.\$\{operation\}`/);
  assert.doesNotMatch(source, /shouldRunAdminAction/);
});

test('admin payment panel labels confirmation as deposit confirmation only', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /입금 확인/);
  assert.doesNotMatch(source, /구독 승인/);
});

test('admin payment panel links deposit requests to the support thread reply view', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /createAdminSupportThreadUrl/);
  assert.match(source, /item\.supportThread/);
  assert.match(source, /입금확인 요청글/);
});

test('admin payment panel exposes direct anchors for payment queue items', async () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const {
    createAdminPaymentUrl,
    getAdminPaymentDomId,
  } = await import('../app/admin/payment-links.ts');

  assert.equal(getAdminPaymentDomId('pay_pending'), 'admin-payment-pay_pending');
  assert.equal(createAdminPaymentUrl('pay_pending'), '/admin#admin-payment-pay_pending');
  assert.equal(createAdminPaymentUrl('pay 1'), '/admin#admin-payment-pay%201');
  assert.match(source, /getAdminPaymentDomId\(item\.payment\.id\)/);
  assert.match(source, /id=\{getAdminPaymentDomId\(item\.payment\.id\)\}/);
  assert.match(cssSource, /\.admin-payment-row:target/);
});

test('pricing copy makes deposit confirmation explicitly manual', () => {
  const pageSource = fs.readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /관리자가 실제 입금 내역을 수동 확인/);
  assert.match(panelSource, /관리자 수동 입금 확인/);
  assert.match(panelSource, /dispatchNotificationsRefreshEvent/);
  assert.doesNotMatch(pageSource, /자동 입금 확인/);
  assert.doesNotMatch(panelSource, /자동 입금 확인/);
});

test('pricing payment request shows admin configured bank and USDT transfer instructions', () => {
  const pageSource = fs.readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /getPaymentTransferSettingsForDisplay/);
  assert.match(pageSource, /paymentSettings=\{paymentSettings\}/);
  assert.match(panelSource, /paymentMethod/);
  assert.match(panelSource, /bankAccountNumber/);
  assert.match(panelSource, /bankAccountHolder/);
  assert.match(panelSource, /usdtAddress/);
  assert.match(panelSource, /usdtNetwork/);
  assert.match(panelSource, /method: paymentMethod/);
});

test('pricing payment request lets members choose a subscription plan from cards', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /plan-card-grid/);
  assert.match(panelSource, /plan-card/);
  assert.match(panelSource, /type="radio"/);
  assert.match(panelSource, /checked=\{selectedPlanId === plan\.id\}/);
  assert.match(panelSource, /onChange=\{\(\) => setSelectedPlanId\(plan\.id\)\}/);
  assert.match(panelSource, /discountedAmount\(plan\)/);
  assert.doesNotMatch(panelSource, /<select id="planId"/);
  assert.match(cssSource, /\.plan-card-grid/);
  assert.match(cssSource, /\.plan-card\.selected/);
});

test('admin payment settings panel and route are wired into operations UI', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-payment-settings-panel.tsx', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/admin/payment-settings/route.ts', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminPaymentSettingsPanel/);
  assert.match(pageSource, /sectionKey="paymentSettings"/);
  assert.match(panelSource, /admin-payment-settings/);
  assert.match(panelSource, /bankAccountNumber/);
  assert.match(panelSource, /bankAccountHolder/);
  assert.match(panelSource, /usdtAddress/);
  assert.match(panelSource, /usdtNetwork/);
  assert.match(routeSource, /updateAsyncPaymentTransferSettings/);
});

test('admin payment panel refreshes its filtered queue after local operations without overwriting success context', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type AdminPanelRefreshOptions = \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'payments'/);
  assert.match(source, /void refresh\(\{ nextMessage: `\$\{paymentId\} 작업이 반영되었습니다\. 목록을 갱신했습니다\.` \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'payments' \}\)/);
});
