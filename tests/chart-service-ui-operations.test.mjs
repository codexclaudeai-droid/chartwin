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
  assert.doesNotMatch(result.supportThread.title, new RegExp(result.payment.id));
  assert.doesNotMatch(result.supportMessage.body, new RegExp(result.payment.id));
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

test('admin payment provisional sale confirms payment and activates subscription directly', async () => {
  const {
    confirmManualPaymentRequest,
  } = await import('../src/server/chart-service/index.ts');
  const repository = createMockChartServiceRepository();

  const result = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T12:10:00.000Z',
    adminNote: '가매출 구독승인',
    provisionalSale: true,
  });
  const paymentQueueItem = listAdminPaymentQueue(repository)
    .find((item) => item.payment.id === 'pay_pending');

  assert.equal(result.payment.status, 'confirmed');
  assert.match(result.payment.adminNote ?? '', /가매출/);
  assert.equal(result.subscription.status, 'active');
  assert.equal(paymentQueueItem?.subscription?.status, 'active');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'payment.provisional_sale.confirm_and_subscription.activate');
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
  assert.match(source, /getPaymentQueueFilterCount/);
  assert.match(source, /quick-filter-count/);
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

test('admin payment completed flow status renders as a readable badge', () => {
  const paymentSource = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const doneBadgeRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-payments \.badge\.manual-flow-badge\.done\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(paymentSource, /<span className=\{`badge manual-flow-badge \$\{flowBadge\.tone\}`\}>/);
  assert.match(doneBadgeRule, /background:\s*rgba\(26, 185, 129, 0\.18\)/);
  assert.match(doneBadgeRule, /border-color:\s*rgba\(77, 255, 181, 0\.42\)/);
  assert.match(doneBadgeRule, /color:\s*#ffffff/);
});

test('admin operation tables render Korean plan period labels', () => {
  const paymentSource = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const subscriptionSource = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');
  const salesSource = fs.readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');

  assert.match(paymentSource, /formatAdminPlanPeriodLabel\(item\.plan\)/);
  assert.match(subscriptionSource, /formatAdminPlanPeriodLabel\(item\.plan\)/);
  assert.match(salesSource, /formatAdminPlanPeriodLabel\(row\.subscriptionPlan\)/);
});

test('admin payment panel confirms irreversible payment operations before posting', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useAdminActionConfirmation/);
  assert.match(source, /await confirmAdminAction/);
  assert.match(source, /\{confirmationDialog\}/);
  assert.match(source, /`payment\.\$\{operation\}`/);
  assert.doesNotMatch(source, /shouldRunAdminAction/);
});

test('admin payment panel exposes quick memo buttons for required admin notes', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /PAYMENT_QUICK_MEMOS/);
  assert.match(source, /applyQuickMemo/);
  assert.match(source, /quick-memo-row/);
  assert.match(source, /입금자명\/금액 일치 확인/);
  assert.match(source, /TXID 수신주소\/금액 일치 확인/);
  assert.match(source, /key: 'provisional-sale'/);
  assert.match(source, /label: '가매출'/);
  assert.match(source, /note: '가매출 구독승인'/);
  assert.match(source, /provisionalSale: operation === 'confirm' && isProvisionalSaleNote\(adminNote\)/);
  assert.match(source, /입금 내역 확인 불가/);
  assert.match(source, /환불 사유 확인 후 처리/);
  assert.match(cssSource, /\.quick-memo-row/);
});

test('admin payment panel groups payment queue details for readability', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /formatAdminPaymentMethodLabel/);
  assert.match(source, /formatAdminPaymentDateTime/);
  assert.match(source, /formatCompactTransactionId/);
  assert.match(source, /admin-payment-id-cell/);
  assert.match(source, /admin-payment-id-meta/);
  assert.match(source, /admin-payment-member-cell/);
  assert.match(source, /admin-payment-txid-box/);
  assert.match(source, /admin-payment-action-cell/);
  assert.match(cssSource, /#admin-payments \.table\s*\{[\s\S]*?table-layout: fixed/s);
  assert.match(cssSource, /\.admin-payment-id-cell \.admin-payment-id-meta\s*\{[\s\S]*?display: grid/s);
  assert.match(cssSource, /\.admin-payment-txid-box/);
  assert.match(cssSource, /\.admin-payment-action-cell \.actions\.compact\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
});

test('admin payment desktop table compacts narrow columns and wraps flow labels', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const statusColumnRule = cssSource.match(
    /#admin-payments \.table th:nth-child\(5\),\s*body:not\(:has\(\.landing-page\)\) #admin-payments \.table td:nth-child\(5\)\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const planColumnRule = cssSource.match(
    /#admin-payments \.table th:nth-child\(3\),\s*body:not\(:has\(\.landing-page\)\) #admin-payments \.table td:nth-child\(3\)\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const memberColumnRule = cssSource.match(
    /#admin-payments \.table th:nth-child\(2\),\s*body:not\(:has\(\.landing-page\)\) #admin-payments \.table td:nth-child\(2\)\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const actionColumnRule = cssSource.match(
    /#admin-payments \.table th:nth-child\(6\),\s*body:not\(:has\(\.landing-page\)\) #admin-payments \.table td:nth-child\(6\)\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(source, /flowBadge\.label\.split\(/);
  assert.match(source, /badgeLines\.map/);
  assert.match(source, /placeholder="메모"/);
  assert.match(statusColumnRule, /width:\s*14%/);
  assert.match(planColumnRule, /width:\s*8%/);
  assert.match(memberColumnRule, /width:\s*18%/);
  assert.match(actionColumnRule, /width:\s*38%/);
  assert.match(cssSource, /#admin-payments \.manual-flow-badge\s*\{[\s\S]*?display: grid[\s\S]*?width: fit-content/s);
  assert.match(cssSource, /#admin-payments \.manual-flow-badge span\s*\{[\s\S]*?white-space: nowrap/s);
  assert.match(cssSource, /#admin-payments \.admin-payment-action-cell \.admin-note-input::placeholder\s*\{[\s\S]*?font-size:\s*0\.7rem/s);
  assert.match(cssSource, /#admin-payments \.admin-payment-action-cell \.quick-memo-button\s*\{[\s\S]*?font-size:\s*0\.68rem/s);
  assert.match(cssSource, /\.admin-payment-action-cell \.button\s*\{[\s\S]*?min-height:\s*32px[\s\S]*?white-space:\s*nowrap/s);
});

test('admin payment summary filters wrap like compact responsive cards', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const quickFilterRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-payments \.quick-filter-row\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(quickFilterRule, /grid-template-columns:\s*repeat\(6, minmax\(96px, 1fr\)\)/);
  assert.match(quickFilterRule, /gap:\s*8px/);
  assert.match(cssSource, /#admin-payments \.quick-filter-row \.button span\s*\{[\s\S]*?text-overflow:\s*ellipsis/s);
  assert.match(cssSource, /#admin-payments \.quick-filter-count\s*\{[\s\S]*?min-width:\s*28px/s);
  assert.match(
    cssSource,
    /@media \(max-width: 1280px\)[\s\S]*?#admin-payments \.quick-filter-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(96px, 1fr\)\)/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1280px\)[\s\S]*?#admin-payments > \.table\s*\{[\s\S]*?display:\s*none/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1280px\)[\s\S]*?#admin-payments \.admin-payment-mobile-list\s*\{[\s\S]*?display:\s*grid/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1180px\)[\s\S]*?#admin-payments \.quick-filter-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(96px, 1fr\)\)/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 720px\)[\s\S]*?#admin-payments \.quick-filter-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(96px, 1fr\)\)/,
  );
});

test('admin payment panel uses a dark operational queue finish', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-payments > \.toolbar/);
  assert.match(cssSource, /#admin-payments \.quick-filter-row\s*\{[\s\S]*?background:/s);
  assert.match(cssSource, /#admin-payments \.quick-filter-row \.button\s*\{[\s\S]*?border-color:/s);
  assert.match(cssSource, /#admin-payments \.table th\s*\{[\s\S]*?background:/s);
  assert.match(cssSource, /#admin-payments \.table td\s*\{[\s\S]*?background:/s);
  assert.match(cssSource, /#admin-payments \.admin-payment-action-cell \.admin-note-input\s*\{[\s\S]*?background:/s);
  assert.match(cssSource, /#admin-payments \.admin-payment-action-cell \.quick-memo-button\s*\{[\s\S]*?border-color:/s);
});

test('admin payment quick filters remove the outer container outline', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const quickFilterRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-payments \.quick-filter-row\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(quickFilterRule, /border:\s*0/);
  assert.match(quickFilterRule, /outline:\s*0/);
  assert.match(quickFilterRule, /box-shadow:\s*none/);
  assert.doesNotMatch(quickFilterRule, /border:\s*1px/);
});

test('admin payment panel flattens nested queue surfaces to reduce padding buildup', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const quickFilterRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-payments \.quick-filter-row\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const txidRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) \.admin-payment-txid-box\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const memoButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-payments \.admin-payment-action-cell \.quick-memo-button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(quickFilterRule, /background:\s*transparent/);
  assert.match(quickFilterRule, /padding:\s*0/);
  assert.match(txidRule, /background:\s*transparent/);
  assert.match(txidRule, /border:\s*0/);
  assert.match(txidRule, /border-top:\s*1px solid rgba\(125, 183, 255, 0\.1\)/);
  assert.match(txidRule, /border-radius:\s*0/);
  assert.match(txidRule, /padding:\s*8px 0 0/);
  assert.match(memoButtonRule, /background:\s*transparent/);
  assert.match(memoButtonRule, /border-color:\s*rgba\(125, 183, 255, 0\.12\)/);
});

test('admin payment panel renders a mobile card list instead of the table', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /admin-payment-mobile-list/);
  assert.match(source, /admin-payment-mobile-card/);
  assert.match(source, /admin-payment-mobile-card-info-grid/);
  assert.match(source, /admin-payment-mobile-card-actions/);
  assert.match(cssSource, /#admin-payments \.admin-payment-mobile-list\s*\{[\s\S]*?display: none/);
  assert.match(cssSource, /@media \(max-width: 1280px\)\s*\{[\s\S]*?#admin-payments > \.table\s*\{[\s\S]*?display: none/);
  assert.match(cssSource, /@media \(max-width: 1280px\)\s*\{[\s\S]*?#admin-payments \.admin-payment-mobile-list\s*\{[\s\S]*?display: grid/);
  assert.match(cssSource, /@media \(max-width: 960px\)\s*\{[\s\S]*?#admin-payments > \.table\s*\{[\s\S]*?display: none/);
  assert.match(cssSource, /@media \(max-width: 960px\)\s*\{[\s\S]*?#admin-payments \.admin-payment-mobile-list\s*\{[\s\S]*?display: grid/);
  assert.match(cssSource, /@media \(max-width: 720px\)\s*\{[\s\S]*?#admin-payments > \.table\s*\{[\s\S]*?display: none/);
  assert.match(cssSource, /@media \(max-width: 720px\)\s*\{[\s\S]*?#admin-payments \.admin-payment-mobile-list\s*\{[\s\S]*?display: grid/);
  assert.match(cssSource, /#admin-payments \.admin-payment-mobile-card-info-grid,[\s\S]*?#admin-subscriptions \.admin-subscription-mobile-card-info-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('admin payment panel removes the outer card shell spacing across viewports', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const panelRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > \.card,\s*body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > div > \.card\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(panelRule, /padding:\s*0\s*!important/);
  assert.match(panelRule, /border:\s*0\s*!important/);
  assert.match(panelRule, /background:\s*transparent\s*!important/);
  assert.match(panelRule, /box-shadow:\s*none\s*!important/);
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

test('landing page presents a concrete conversion layout for the subscription service', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const heroSource = fs.readFileSync(new URL('../app/landing-hero-slider.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /getAsyncChartServicePersistence/);
  assert.match(pageSource, /persistence\.runRead/);
  assert.match(pageSource, /repository\.listPlans\(\)/);
  assert.match(pageSource, /calculateLandingPlanPrice/);
  assert.match(pageSource, /LandingHeroSlider/);
  assert.match(pageSource, /landing-hero/);
  assert.match(heroSource, /'use client'/);
  assert.match(heroSource, /landingHeroSlides/);
  assert.match(heroSource, /setActiveSlide/);
  assert.match(heroSource, /landing-hero-stage/);
  assert.match(heroSource, /landing-hero-slide/);
  assert.match(heroSource, /landing-hero-slide active/);
  assert.match(heroSource, /backgroundClass/);
  assert.match(heroSource, /landing-hero-bg/);
  assert.match(heroSource, /hero-bg-approval/);
  assert.match(heroSource, /hero-bg-deposit/);
  assert.match(heroSource, /hero-bg-workspace/);
  assert.match(heroSource, /landing-hero-title/);
  assert.match(heroSource, /landing-hero-body/);
  assert.match(heroSource, /landing-hero-actions/);
  assert.match(heroSource, /landing-hero-controls/);
  assert.match(heroSource, /aria-pressed/);
  assert.doesNotMatch(heroSource, /tags:/);
  assert.doesNotMatch(heroSource, /landing-hero-status-pills/);
  assert.doesNotMatch(heroSource, /Bank transfer/);
  assert.doesNotMatch(heroSource, /USDT transfer/);
  assert.doesNotMatch(heroSource, /Admin approval/);
  assert.match(heroSource, /Precision Algorithmic Technical Analysis/);
  assert.match(heroSource, /복잡한 시장의 흐름을 한눈에, 정밀한 실시간 트레이딩 시그널/);
  assert.match(heroSource, /TradingCore의 고도화된 퀀트 알고리즘/);
  assert.match(heroSource, /The Second Edge for Profit/);
  assert.match(heroSource, /망설임 없는 진입을 완성하는 초고속 실시간 차트 알림/);
  assert.match(heroSource, /Intuitive & Visual Charts for Everyone/);
  assert.doesNotMatch(heroSource, /구독 절차 보기/);
  assert.doesNotMatch(heroSource, /#landing-process/);
  assert.match(pageSource, /TradingCore \| 실시간 알고리즘 트레이딩 시그널/);
  assert.match(heroSource, /무료체험 신청/);
  assert.match(heroSource, /secondaryHref: 'free-trial'/);
  assert.match(heroSource, /FreeTrialRequestButton/);
  assert.match(pageSource, /tcChartFeatures/);
  assert.match(pageSource, /landing-tc-chart-features/);
  assert.match(pageSource, /TC Chart 기능/);
  assert.match(pageSource, /다중 지표 교차 검증을 통한 고정밀 시그널/);
  assert.match(pageSource, /시장을 떠나 있어도 기회를 포착하는 실시간 알림 시스템/);
  assert.match(pageSource, /프로급 차트와 강력한 분석 도구 지원/);
  assert.match(pageSource, /신뢰할 수 있는 백테스팅 지표 공개/);
  assert.match(pageSource, /온사이트 실시간 알림/);
  assert.match(pageSource, /텔레그램 연동 지원/);
  assert.match(pageSource, /추세선·채널 작도/);
  assert.match(pageSource, /BASIC/);
  assert.match(pageSource, /PRO/);
  assert.match(pageSource, /ELITE/);
  assert.match(pageSource, /자주 묻는 질문/);
  assert.match(pageSource, /contactActionCards/);
  assert.match(pageSource, /landing-contact-actions/);
  assert.match(pageSource, /1:1 문의/);
  assert.match(pageSource, /제휴문의/);
  assert.match(pageSource, /무료체험신청/);
  assert.doesNotMatch(pageSource, /운영 성과/);
  assert.doesNotMatch(pageSource, /conversionRouteCards/);
  assert.doesNotMatch(pageSource, /landing-conversion-routes/);
  assert.doesNotMatch(pageSource, /3가지 시작 경로/);
  assert.doesNotMatch(pageSource, /landing-chart-preview/);
  assert.doesNotMatch(pageSource, /chart-preview-shell/);
  assert.doesNotMatch(pageSource, /previewCandles/);
  assert.match(pageSource, /export const metadata/);
  assert.match(pageSource, /검증된 실시간 알고리즘 시그널과 프로급 차트 분석 도구/);
  assert.match(pageSource, /openGraph/);
  assert.match(pageSource, /application\/ld\+json/);
  assert.match(pageSource, /FAQPage/);
  assert.match(pageSource, /landing-mobile-cta/);
  assert.match(pageSource, /aria-label="모바일 빠른 구독 이동"/);
  assert.match(pageSource, /landing-anchor-nav/);
  assert.match(pageSource, /href="#landing-tc-chart-features"/);
  assert.doesNotMatch(pageSource, /href="#landing-process"/);
  assert.match(pageSource, /href="#landing-plans"/);
  assert.match(pageSource, /href="#landing-faq"/);
  assert.match(pageSource, /href="#landing-contact-actions"/);
  assert.match(pageSource, /<details className="landing-faq-card"/);
  assert.match(pageSource, /<summary>/);
  assert.doesNotMatch(pageSource, /landing-faq-actions/);
  assert.doesNotMatch(pageSource, /고객센터로 문의하기/);
  assert.doesNotMatch(pageSource, /구독 플랜 다시 보기/);
  assert.match(pageSource, /landing-footer/);
  assert.match(pageSource, /이용약관/);
  assert.match(pageSource, /개인정보보호정책/);
  assert.match(pageSource, /사업자 정보 고지/);
  assert.match(pageSource, /© TradingCore/);
  assert.match(pageSource, /href="\/pricing"/);
  assert.match(pageSource, /href="\/signup"/);
  assert.match(pageSource, /href="\/support"/);
  assert.match(cssSource, /\.landing-hero/);
  assert.match(cssSource, /\.landing-hero-stage/);
  assert.match(cssSource, /\.landing-hero-bg/);
  assert.match(cssSource, /\.hero-bg-approval/);
  assert.match(cssSource, /\.hero-bg-deposit/);
  assert.match(cssSource, /\.hero-bg-workspace/);
  assert.match(cssSource, /\.landing-hero-slide/);
  assert.match(cssSource, /\.landing-hero-slide\.active/);
  assert.match(cssSource, /\.landing-hero-slide\.active \.landing-hero-bg/);
  assert.match(cssSource, /\.landing-hero-slide\.active \.eyebrow/);
  assert.match(cssSource, /\.landing-hero-slide\.active \.landing-hero-title/);
  assert.match(cssSource, /\.landing-hero-slide\.active \.landing-hero-body/);
  assert.match(cssSource, /\.landing-hero-slide\.active \.landing-hero-actions/);
  assert.match(heroSource, /Precision Algorithmic Technical Analysis/);
  assert.match(heroSource, /복잡한 시장의 흐름을 한눈에, 정밀한 실시간 트레이딩 시그널/);
  assert.match(heroSource, /The Second Edge for Profit/);
  assert.match(heroSource, /망설임 없는 진입을 완성하는 초고속 실시간 차트 알림/);
  assert.match(heroSource, /Intuitive & Visual Charts for Everyone/);
  assert.match(heroSource, /당신은 오직 '수익'에만 집중하세요/);
  assert.match(cssSource, /font-size: clamp\(30px, 3\.2vw, 48px\)/);
  assert.match(cssSource, /line-height: 1\.18/);
  assert.doesNotMatch(cssSource, /line-height: 0\.92/);
  assert.match(cssSource, /\.landing-hero-controls/);
  assert.match(cssSource, /\.landing-hero-control/);
  assert.doesNotMatch(heroSource, /LandingLiveCandleCanvas/);
  assert.match(heroSource, /heroCandleSeed/);
  assert.match(heroSource, /const heroCandleSpacing = 2/);
  assert.match(heroSource, /const heroCandleStart = -5/);
  assert.match(heroSource, /heroCandleTrendRegimes/);
  assert.match(heroSource, /phase: 'uptrend'/);
  assert.match(heroSource, /phase: 'range'/);
  assert.match(heroSource, /phase: 'downtrend'/);
  assert.match(heroSource, /function getHeroCandleOffset\(index/);
  assert.match(heroSource, /Math\.sin\(index \* 1\.7\)/);
  assert.match(heroSource, /offset: getHeroCandleOffset\(index\)/);
  assert.match(heroSource, /Array\.from\(\{ length: 56 \}/);
  assert.match(heroSource, /left: `\$\{heroCandleStart \+ index \* heroCandleSpacing\}%`/);
  assert.doesNotMatch(heroSource, /animationDelay: `\$\{candleIndex \* 80\}ms`/);
  assert.doesNotMatch(heroSource, /heroTrendWave/);
  assert.match(heroSource, /<div className="landing-hero-chart-board" aria-hidden="true">/);
  assert.match(heroSource, /landing-hero-chart-stream/);
  assert.match(heroSource, /landing-hero-chart-track/);
  assert.match(heroSource, /landing-hero-chart-segment/);
  assert.match(heroSource, /landing-hero-chart-candle/);
  assert.match(heroSource, /landing-hero-chart-signal/);
  assert.doesNotMatch(pageSource, /landing-scroll-transition/);
  assert.doesNotMatch(pageSource, /landing-trend-path/);
  assert.doesNotMatch(pageSource, /landing-trend-line-fill/);
  assert.doesNotMatch(pageSource, /landing-signal-node/);
  assert.doesNotMatch(pageSource, /landing-signal-ripple/);
  assert.doesNotMatch(pageSource, /landing-scroll-wheel/);
  assert.match(cssSource, /\.landing-hero-chart-board/);
  assert.doesNotMatch(cssSource, /padding-block: 34px/);
  assert.match(cssSource, /\.landing-hero-chart-stream/);
  assert.match(cssSource, /-webkit-mask-image: linear-gradient\(90deg, transparent 0%, rgba\(0, 0, 0, 0\.3\) 7%, #000 18%, #000 100%\)/);
  assert.match(cssSource, /mask-image: linear-gradient\(90deg, transparent 0%, rgba\(0, 0, 0, 0\.3\) 7%, #000 18%, #000 100%\)/);
  assert.match(cssSource, /\.landing-hero-chart-track/);
  assert.match(cssSource, /\.landing-hero-chart-segment/);
  assert.match(cssSource, /animation: heroCandleTrackMove 34s linear infinite/);
  assert.match(cssSource, /@keyframes heroCandleTrackMove/);
  assert.match(cssSource, /transform: translate3d\(-50%, 0, 0\)/);
  assert.match(cssSource, /\.landing-hero-chart-candle/);
  assert.match(cssSource, /left: var\(--candle-left\)/);
  assert.match(cssSource, /width: var\(--candle-width\)/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.up\s*\{[^}]*bottom:/s);
  assert.match(cssSource, /\.landing-hero-chart-candle\.down\s*\{[^}]*top:/s);
  assert.match(cssSource, /position: absolute/);
  assert.doesNotMatch(cssSource, /transition: left 720ms linear/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.up/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.down/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.doji/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.squeeze/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.inverted-hammer/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.marubozu::before/);
  assert.match(cssSource, /display: none/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.up::before\s*\{[^}]*linear-gradient\(180deg, rgba\(255, 111, 124, 0\.95\), rgba\(215, 48, 73, 0\.48\)\)/s);
  assert.match(cssSource, /\.landing-hero-chart-candle\.down::before\s*\{[^}]*linear-gradient\(180deg, rgba\(125, 183, 255, 0\.92\), rgba\(49, 90, 170, 0\.5\)\)/s);
  assert.match(cssSource, /\.landing-hero-chart-signal/);
  assert.match(cssSource, /\.landing-hero-chart-signal\.buy/);
  assert.match(cssSource, /\.landing-hero-chart-signal\.sell/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.up \.landing-hero-chart-signal\.sell/);
  assert.match(cssSource, /\.landing-hero-chart-candle\.down \.landing-hero-chart-signal\.buy/);
  assert.match(cssSource, /@keyframes heroSignalPop/);
  assert.match(cssSource, /@keyframes heroCandleDraw/);
  assert.doesNotMatch(cssSource, /\.landing-hero-chart-stream\s*\{[^}]*animation:/);
  assert.doesNotMatch(cssSource, /@keyframes heroCandleStream/);
  assert.doesNotMatch(cssSource, /@keyframes heroChartDrift/);
  assert.match(cssSource, /\.landing-scroll-transition/);
  assert.match(cssSource, /Scroll-linked hero-to-feature guide removed for a calmer landing flow/);
  assert.match(cssSource, /\.landing-scroll-transition\s*\{[^}]*display: none/s);
  assert.match(cssSource, /\.landing-page \.landing-scroll-transition\s*\{[^}]*height: 0/s);
  assert.match(cssSource, /\.landing-trend-path/);
  assert.match(cssSource, /\.landing-signal-node/);
  assert.match(cssSource, /\.landing-signal-ripple/);
  assert.doesNotMatch(cssSource, /@supports \(animation-timeline: scroll\(\)\)/);
  assert.doesNotMatch(cssSource, /animation-timeline: scroll\(\)/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card\s*\{[^}]*animation: none/s);
  assert.match(cssSource, /@keyframes featureCardSignalActivate/);
  assert.match(cssSource, /animation: heroSlideIn/);
  assert.match(cssSource, /animation: heroBackgroundReveal/);
  assert.match(cssSource, /animation: heroContentReveal/);
  assert.match(cssSource, /animation-delay: 260ms/);
  assert.match(cssSource, /animation-delay: 420ms/);
  assert.match(cssSource, /animation-delay: 580ms/);
  assert.match(cssSource, /animation-delay: 740ms/);
  assert.match(cssSource, /@keyframes heroSlideIn/);
  assert.match(cssSource, /@keyframes heroBackgroundReveal/);
  assert.match(cssSource, /@keyframes heroContentReveal/);
  assert.match(cssSource, /\.landing-tc-chart-features/);
  assert.match(cssSource, /\.tc-chart-feature-grid/);
  assert.match(cssSource, /\.tc-chart-feature-card/);
  assert.match(cssSource, /\.landing-plan-card\.featured/);
  assert.match(cssSource, /\.landing-contact-grid/);
  assert.match(cssSource, /\.landing-contact-card/);
  assert.match(cssSource, /\.landing-faq-grid/);
  assert.match(cssSource, /\.landing-mobile-cta/);
  assert.match(cssSource, /position: fixed/);
  assert.match(cssSource, /\.landing-anchor-nav/);
  assert.match(cssSource, /scroll-margin-top/);
  assert.match(cssSource, /\.landing-faq-card summary/);
  assert.match(cssSource, /\.landing-faq-actions/);
  assert.match(cssSource, /\.landing-footer/);
  assert.match(cssSource, /\.landing-footer-grid/);
  assert.match(cssSource, /\.landing-footer-links/);
  assert.doesNotMatch(pageSource, /landing-motion-rail/);
  assert.doesNotMatch(pageSource, /landing-motion-track/);
  assert.doesNotMatch(pageSource, /landing-hero-proof-strip/);
});

test('landing footer uses the header logo image instead of a text wordmark', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /<strong>TradingCore<\/strong>/);
  assert.match(pageSource, /className="landing-footer-logo"/);
  assert.match(pageSource, /src="\/images\/TC-main-logo\.png"/);
  assert.match(pageSource, /alt="TradingCore"/);
  assert.match(cssSource, /\.landing-footer-logo\s*\{[^}]*height: 24px/s);
  assert.match(cssSource, /\.landing-footer-logo\s*\{[^}]*width: auto/s);
});

test('root layout exposes favicon and installable home screen icons', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const manifestPath = new URL('../public/site.webmanifest', import.meta.url);
  const iconFiles = [
    '../public/favicon.ico',
    '../public/favicon.svg',
    '../public/favicon-16x16.png',
    '../public/favicon-32x32.png',
    '../public/apple-touch-icon.png',
    '../public/android-chrome-192x192.png',
    '../public/android-chrome-512x512.png',
  ];

  assert.match(layoutSource, /manifest: '\/site\.webmanifest'/);
  assert.match(layoutSource, /icons:\s*\{/);
  assert.match(layoutSource, /url: '\/favicon\.ico'/);
  assert.match(layoutSource, /url: '\/favicon\.svg', type: 'image\/svg\+xml'/);
  assert.match(layoutSource, /url: '\/apple-touch-icon\.png', sizes: '180x180'/);
  assert.equal(fs.existsSync(manifestPath), true);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'TradingCore');
  assert.deepEqual(
    manifest.icons.map((icon) => `${icon.src}:${icon.sizes}:${icon.purpose}`).sort(),
    [
      '/android-chrome-192x192.png:192x192:any maskable',
      '/android-chrome-512x512.png:512x512:any maskable',
    ],
  );

  for (const iconFile of iconFiles) {
    const iconPath = new URL(iconFile, import.meta.url);
    assert.equal(fs.existsSync(iconPath), true, `${iconFile} should exist`);
    assert.equal(fs.statSync(iconPath).size > 0, true, `${iconFile} should not be empty`);
  }
});

test('landing page exposes a completed premium design layer', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const heroSource = fs.readFileSync(new URL('../app/landing-hero-slider.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(heroSource, /landing-hero-stage/);
  assert.match(heroSource, /landing-hero-controls/);
  assert.match(heroSource, /회원가입/);
  assert.match(heroSource, /플랜보기/);
  assert.match(heroSource, /무료체험 신청/);
  assert.doesNotMatch(pageSource, /landing-operator-ribbon/);
  assert.doesNotMatch(pageSource, /landing-design-showcase/);
  assert.match(heroSource, /정밀한 실시간 트레이딩 시그널/);
  assert.doesNotMatch(pageSource, /구독 전 확인할 운영 기준/);
  assert.doesNotMatch(pageSource, /서비스 흐름/);
  assert.doesNotMatch(pageSource, /결제 신뢰/);
  assert.doesNotMatch(pageSource, /관리자 운영/);
  assert.doesNotMatch(pageSource, /서비스 랜딩입니다/);
  assert.doesNotMatch(pageSource, /랜딩에서는/);
  assert.doesNotMatch(pageSource, /실서비스 준비 완료에 가까운/);
  assert.doesNotMatch(pageSource, /Launch Ready/);
  assert.match(cssSource, /\.landing-page::before/);
  assert.match(cssSource, /\.landing-hero-stage/);
  assert.match(cssSource, /\.landing-hero-controls/);
  assert.match(cssSource, /Hero compact height pass/);
  assert.match(cssSource, /min-height: clamp\(434px, calc\(70svh - 52px\), 574px\)/);
  assert.match(cssSource, /Hero slide full-bleed fill pass/);
  assert.match(cssSource, /\.landing-page \.landing-hero\s*\{[^}]*padding: 0/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-stage\s*\{[^}]*inset: 0/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-slide\s*\{[^}]*height: 100%/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-slide\s*\{[^}]*width: 100%/s);
  assert.match(cssSource, /Hero slide controls: circular dots expand into a horizontal active pill/);
  assert.match(cssSource, /\.landing-page \.landing-hero-controls\s*\{[^}]*display: flex/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-controls\s*\{[^}]*bottom: 72px/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-controls\s*\{[^}]*border: 0/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-controls\s*\{[^}]*box-shadow: none/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-controls\s*\{[^}]*background: transparent/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-control\s*\{[^}]*width: 34px/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-control\.active\s*\{[^}]*width: clamp\(154px, 18vw, 218px\)/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-control\.active strong\s*\{[^}]*opacity: 1/s);
  assert.match(cssSource, /Anchor navigation final blue glass pass/);
  assert.match(cssSource, /\.landing-page \.landing-anchor-nav\s*\{[^}]*rgba\(8, 17, 31, 0\.82\)/s);
  assert.match(cssSource, /\.landing-page \.landing-anchor-nav\s*\{[^}]*rgba\(125, 183, 255, 0\.2\)/s);
  assert.match(cssSource, /\.landing-page \.landing-anchor-nav a\s*\{[^}]*rgba\(216, 236, 255, 0\.78\)/s);
  assert.match(cssSource, /Anchor navigation boundary alignment between hero and feature sections/);
  assert.match(cssSource, /\.landing-page \.landing-anchor-nav\s*\{[^}]*margin: -22px auto -22px/s);
  assert.match(cssSource, /\.landing-page \.landing-tc-chart-features\s*\{[^}]*padding-top: clamp\(64px, 6vw, 86px\)/s);
  assert.match(cssSource, /Match the TC Chart feature heading width to the feature card grid/);
  assert.match(cssSource, /\.landing-page \.landing-tc-chart-features \.section-heading\s*\{[^}]*width: 100%/s);
  assert.match(cssSource, /\.landing-page \.landing-tc-chart-features \.section-heading h2\s*\{[^}]*max-width: min\(100%, 980px\)/s);
  assert.match(cssSource, /\.landing-page \.landing-tc-chart-features \.section-heading h2\s*\{[^}]*white-space: normal/s);
  assert.match(cssSource, /\.landing-page \.landing-tc-chart-features \.section-heading h2\s*\{[^}]*word-break: keep-all/s);
  assert.match(cssSource, /@media \(max-width: 1180px\)\s*\{[^}]*\.landing-page \.landing-tc-chart-features \.section-heading h2\s*\{[^}]*max-width: 820px/s);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[^}]*\.landing-page \.landing-tc-chart-features \.section-heading h2\s*\{[^}]*text-wrap: pretty/s);
  assert.match(cssSource, /Hero slide outline removal/);
  assert.match(cssSource, /\.landing-page \.landing-hero-stage,[\s\S]*?\.landing-page \.landing-hero-slide\.active\s*\{[^}]*border: 0/s);
  assert.match(cssSource, /\.landing-page \.landing-hero-stage,[\s\S]*?\.landing-page \.landing-hero-slide\.active\s*\{[^}]*outline: 0/s);
  assert.match(cssSource, /Hide the browser scrollbar on the landing page while preserving scroll/);
  assert.match(cssSource, /html:has\(\.landing-page\),\s*body:has\(\.landing-page\)\s*\{[^}]*scrollbar-width: none/s);
  assert.match(cssSource, /html:has\(\.landing-page\)::\-webkit-scrollbar,\s*body:has\(\.landing-page\)::\-webkit-scrollbar\s*\{[^}]*width: 0/s);
  assert.match(cssSource, /\.landing-contact-actions/);
  assert.match(cssSource, /backdrop-filter/);
  assert.match(cssSource, /animation: landingFadeUp/);
  assert.match(cssSource, /@keyframes landingFadeUp/);
  assert.match(cssSource, /\.landing-page \.button\.secondary:hover/);
  assert.match(cssSource, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /\.landing-hero-control strong/);
  assert.match(cssSource, /display: none/);
  assert.match(cssSource, /\.landing-hero-actions \.button/);
  assert.match(cssSource, /counter-reset: tcFeature/);
  assert.match(cssSource, /counter-increment: tcFeature/);
  assert.match(cssSource, /content: "0" counter\(tcFeature\)/);
  assert.match(cssSource, /\.tc-chart-feature-card:hover/);
});

test('landing page applies scroll fade in and out motion to sections and cards', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const fadeSource = fs.readFileSync(new URL('../app/landing-scroll-fade-motion.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /import LandingScrollFadeMotion from '\.\/landing-scroll-fade-motion\.tsx'/);
  assert.match(pageSource, /<LandingScrollFadeMotion \/>/);
  assert.match(fadeSource, /'use client'/);
  assert.match(fadeSource, /IntersectionObserver/);
  assert.match(fadeSource, /landing-scroll-fade/);
  assert.match(fadeSource, /is-visible/);
  assert.match(fadeSource, /is-exiting/);
  assert.match(fadeSource, /landing-section/);
  assert.match(fadeSource, /tc-chart-feature-card/);
  assert.match(cssSource, /\.landing-page \.landing-scroll-fade\s*\{[^}]*opacity: 0/s);
  assert.match(cssSource, /\.landing-page \.landing-scroll-fade\.is-visible\s*\{[^}]*opacity: 1/s);
  assert.match(cssSource, /\.landing-page \.landing-scroll-fade\.is-exiting\s*\{[^}]*opacity: 0/s);
  assert.match(cssSource, /transition: opacity 520ms ease, transform 620ms/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.landing-page \.landing-scroll-fade/s);
});

test('landing hero removes fine grid overlays from the first viewport', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /Hero first viewport grid removal pass/);
  assert.match(cssSource, /\.landing-page::before\s*\{[\s\S]*?background:\s*none/);
  assert.match(cssSource, /\.landing-page \.landing-hero-stage::before\s*\{[\s\S]*?linear-gradient\(145deg, rgba\(255, 255, 255, 0\.08\), rgba\(255, 255, 255, 0\.025\)\)/);
  assert.match(cssSource, /\.landing-page \.landing-hero-stage::before\s*\{[\s\S]*?background-size:\s*auto/);
  assert.match(cssSource, /\.landing-page \.landing-hero-slide::after\s*\{[\s\S]*?background:\s*linear-gradient\(90deg, rgba\(2, 7, 19, 0\.02\), rgba\(125, 183, 255, 0\.035\)\)/);
  assert.match(cssSource, /\.landing-page \.landing-hero-slide::after\s*\{[\s\S]*?opacity:\s*0\.42/);
});

test('landing page shows a bottom-right scroll-to-top jump button after scrolling', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const scrollButtonSource = fs.readFileSync(new URL('../app/landing-scroll-top-button.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /LandingScrollTopButton/);
  assert.match(pageSource, /<LandingScrollTopButton \/>/);
  assert.match(scrollButtonSource, /'use client'/);
  assert.match(scrollButtonSource, /window\.scrollY > 420/);
  assert.match(scrollButtonSource, /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(scrollButtonSource, /landing-scroll-top-button/);
  assert.match(scrollButtonSource, /aria-label="페이지 상단으로 이동"/);
  assert.match(cssSource, /\.landing-page \.landing-scroll-top-button\s*\{[\s\S]*?position: fixed/);
  assert.match(cssSource, /\.landing-page \.landing-scroll-top-button\s*\{[\s\S]*?right: clamp\(18px, 3vw, 34px\)/);
  assert.match(cssSource, /\.landing-page \.landing-scroll-top-button\s*\{[\s\S]*?bottom: clamp\(22px, 4vw, 42px\)/);
  assert.match(cssSource, /\.landing-page \.landing-scroll-top-button\.visible\s*\{[\s\S]*?opacity: 1/);
});

test('TradingCore brand identity stays in the shell without duplicating hero stamp content', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(layoutSource, /brand-mark/);
  assert.match(layoutSource, /brand-wordmark/);
  assert.match(layoutSource, /TradingCore/);
  assert.doesNotMatch(pageSource, /landing-brand-stamp/);
  assert.doesNotMatch(pageSource, /TradingCore Command Layer/);
  assert.doesNotMatch(pageSource, /차트·시그널·승인 운영을 하나의 코어로 연결합니다/);
  assert.doesNotMatch(pageSource, /Built for subscription trading operations/);
  assert.match(cssSource, /\.brand-mark/);
  assert.match(cssSource, /\.brand-wordmark/);
  assert.doesNotMatch(cssSource, /\.landing-brand-stamp/);
  assert.doesNotMatch(cssSource, /\.landing-brand-stamp::before/);
});

test('top navigation links the landing page to the TC Chart route', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const mobileNavSource = fs.readFileSync(new URL('../app/mobile-nav.tsx', import.meta.url), 'utf8');

  assert.match(layoutSource, /<nav className="nav" aria-label="Primary">/);
  assert.match(layoutSource, /<Link href="\/chart" aria-label="TC Chart 페이지">TC차트<\/Link>/);
  assert.match(layoutSource, /<Link href="\/#landing-plans">구독<\/Link>/);
  assert.match(layoutSource, /<Link href="\/support">고객센터<\/Link>/);
  assert.doesNotMatch(layoutSource, /<ProfileNavLink \/>/);
  assert.match(mobileNavSource, /<ProfileNavLink \/>/);
  assert.equal(
    ((layoutSource + mobileNavSource).match(/<Link href="\/#landing-plans"/g) ?? []).length,
    2,
  );
  assert.match(mobileNavSource, /from 'lucide-react'/);
  assert.match(mobileNavSource, /Home/);
  assert.match(mobileNavSource, /ChartCandlestick/);
  assert.match(mobileNavSource, /ReceiptText/);
  assert.match(mobileNavSource, /Headset/);
  assert.match(mobileNavSource, /mobile-nav-link-icon/);
  assert.match(mobileNavSource, /mobile-nav-link-label/);
  assert.doesNotMatch(layoutSource, /<Link href="\/pricing">구독<\/Link>/);
  assert.match(layoutSource, /<MobileNav \/>/);

  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(cssSource, /Mobile topbar hamburger menu with left drawer slide motion/);
  assert.match(cssSource, /\.mobile-nav\s*\{[^}]*outline: 0/s);
  assert.match(cssSource, /\.mobile-nav:focus-within,\s*\.mobile-nav\.open\s*\{[^}]*outline: 0/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*rgba\(15, 29, 52, 0\.98\)/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*border: 1px solid rgba\(125, 183, 255, 0\.24\) !important/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*0 22px 56px rgba\(0, 0, 0, 0\.42\)/s);
  assert.match(cssSource, /\.mobile-nav-link-icon\s*\{[^}]*color: rgba\(125, 183, 255, 0\.92\)/s);
  assert.match(cssSource, /\.mobile-nav-link-icon svg\s*\{[^}]*height: 18px/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-toggle span:nth-child\(1\)\s*\{[^}]*rotate\(45deg\)/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-toggle span:nth-child\(2\)\s*\{[^}]*opacity: 0/s);
  assert.match(cssSource, /@media \(max-width: 900px\)\s*\{[\s\S]*?\.nav\s*\{[\s\S]*?gap: 22px/);
  assert.match(cssSource, /@media \(max-width: 900px\)\s*\{[\s\S]*?\.nav a,[\s\S]*?\.session a,[\s\S]*?\.session-button\s*\{[\s\S]*?white-space: nowrap/);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.topbar > \.nav,[\s\S]*?\.topbar > \.session\s*\{[^}]*display: none/s);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.mobile-nav\s*\{[^}]*display: block/s);
});

test('mobile nav toggle morphs to X only while the menu is open', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(cssSource, /\.mobile-nav-toggle:hover span:nth-child\(1\),[\s\S]*?rotate\(45deg\)/s);
  assert.doesNotMatch(cssSource, /\.mobile-nav-toggle:focus-visible span:nth-child\(1\),[\s\S]*?rotate\(45deg\)/s);
  assert.doesNotMatch(cssSource, /\.mobile-nav-toggle:hover span:nth-child\(2\),[\s\S]*?opacity: 0/s);
  assert.doesNotMatch(cssSource, /\.mobile-nav-toggle:focus-visible span:nth-child\(2\),[\s\S]*?opacity: 0/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-toggle span:nth-child\(1\)\s*\{[^}]*rotate\(45deg\)/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-toggle span:nth-child\(2\)\s*\{[^}]*opacity: 0/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-toggle span:nth-child\(3\)\s*\{[^}]*rotate\(-45deg\)/s);
});

test('mobile navigation slides from the left and closes on menu or outside touch', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const mobileNavSource = fs.readFileSync(new URL('../app/mobile-nav.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(layoutSource, /import \{ MobileNav \} from '\.\/mobile-nav'/);
  assert.match(mobileNavSource, /'use client'/);
  assert.match(mobileNavSource, /const \[isOpen, setIsOpen\] = useState\(false\)/);
  assert.match(mobileNavSource, /className=\{`mobile-nav \$\{isOpen \? 'open' : ''\}`\.trim\(\)\}/);
  assert.match(mobileNavSource, /aria-expanded=\{isOpen\}/);
  assert.match(mobileNavSource, /onClick=\{\(\) => setIsOpen\(false\)\}/);
  assert.match(mobileNavSource, /handlePanelClick/);
  assert.match(mobileNavSource, /closest\('a, button'\)/);
  assert.match(mobileNavSource, /setIsOpen\(false\)/);
  assert.match(cssSource, /\.mobile-nav-toggle\s*\{[^}]*aspect-ratio: 1 \/ 1/s);
  assert.match(cssSource, /\.mobile-nav-toggle\s*\{[^}]*width: 44px/s);
  assert.match(cssSource, /\.mobile-nav-toggle\s*\{[^}]*height: 44px/s);
  assert.match(cssSource, /\.mobile-nav-toggle\s*\{[^}]*z-index: 90/s);
  assert.match(cssSource, /\.topbar:has\(\.mobile-nav\.open\)\s*\{[^}]*z-index: 90/s);
  assert.match(cssSource, /\.mobile-nav-backdrop\s*\{[^}]*position: fixed/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*left: 0/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*transform: translateX\(-104%\)/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-panel\s*\{[^}]*transform: translateX\(0\)/s);
  assert.match(cssSource, /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?-webkit-tap-highlight-color: transparent/s);
});

test('mobile navigation links use lucide concept icons before labels', () => {
  const mobileNavSource = fs.readFileSync(new URL('../app/mobile-nav.tsx', import.meta.url), 'utf8');
  const profileSource = fs.readFileSync(new URL('../app/profile-nav-link.tsx', import.meta.url), 'utf8');
  const notificationSource = fs.readFileSync(new URL('../app/notification-nav-link.tsx', import.meta.url), 'utf8');
  const adminSource = fs.readFileSync(new URL('../app/admin-nav-link.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(mobileNavSource, /Home/);
  assert.match(mobileNavSource, /ChartCandlestick/);
  assert.match(mobileNavSource, /ReceiptText/);
  assert.match(mobileNavSource, /Headset/);
  assert.match(profileSource, /UserRound/);
  assert.match(notificationSource, /BellRing/);
  assert.match(adminSource, /ShieldCheck/);
  assert.match((mobileNavSource.match(/mobile-nav-link-icon/g) ?? []).join(' '), /mobile-nav-link-icon/);
  assert.match(profileSource, /mobile-nav-link-icon/);
  assert.match(notificationSource, /mobile-nav-link-icon/);
  assert.match(adminSource, /mobile-nav-link-icon/);
  assert.match(cssSource, /\.mobile-nav-links a\s*\{[\s\S]*?gap:\s*10px[\s\S]*?justify-content:\s*flex-start/);
  assert.match(cssSource, /\.mobile-nav-links a \.nav-badge\s*\{[\s\S]*?margin-left:\s*auto/);
});

test('mobile navigation drawer has compact square-edged panel with internal close control and session divider', () => {
  const mobileNavSource = fs.readFileSync(new URL('../app/mobile-nav.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(mobileNavSource, /className="mobile-nav-panel-close"/);
  assert.match(mobileNavSource, /aria-label="모바일 메뉴 닫기"/);
  assert.equal((mobileNavSource.match(/<span aria-hidden="true" \/>/g) ?? []).length, 6);
  assert.doesNotMatch(mobileNavSource, />×<\/span>/);
  assert.match(mobileNavSource, /onClick=\{\(\) => setIsOpen\(false\)\}/);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*border-radius: 0/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*max-width: 288px/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*min-width: min\(256px, calc\(100vw - 84px\)\)/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*width: min\(272px, calc\(100vw - 84px\)\)/s);
  assert.match(cssSource, /\.mobile-nav-panel\s*\{[^}]*padding: 8px 12px 18px/s);
  assert.match(cssSource, /\.mobile-nav-panel-close\s*\{[^}]*align-self: flex-start/s);
  assert.match(cssSource, /\.mobile-nav-panel-close\s*\{[^}]*height: 44px/s);
  assert.match(cssSource, /\.mobile-nav-panel-close\s*\{[^}]*width: 44px/s);
  assert.match(cssSource, /\.mobile-nav-toggle span,\s*\.mobile-nav-panel-close span\s*\{[^}]*transition: transform 180ms ease, opacity 180ms ease, width 180ms ease, background 180ms ease/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-panel-close span:nth-child\(1\)\s*\{[^}]*rotate\(45deg\)/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-panel-close span:nth-child\(2\)\s*\{[^}]*opacity: 0/s);
  assert.match(cssSource, /\.mobile-nav\.open \.mobile-nav-panel-close span:nth-child\(3\)\s*\{[^}]*rotate\(-45deg\)/s);
  assert.match(cssSource, /\.mobile-nav-panel \.session\s*\{[^}]*border-top: 1px solid rgba\(125, 183, 255, 0\.22\)/s);
});

test('login page uses production account copy without mock wording', () => {
  const loginSource = fs.readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

  assert.match(loginSource, /TradingCore 계정/);
  assert.doesNotMatch(loginSource, /mock|목업|임시/i);
});

test('login page aligns login and logout actions to the right', () => {
  const panelSource = fs.readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /actions compact login-actions/);
  assert.match(cssSource, /\.auth-card \.login-actions\s*\{[\s\S]*?justify-content:\s*flex-end/);
});

test('landing page presents TC Chart feature capabilities under the TradingCore website brand', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const landingSpecSource = fs.readFileSync(new URL('../landing-page.md', import.meta.url), 'utf8');

  assert.match(landingSpecSource, /Website name: TradingCore/);
  assert.match(landingSpecSource, /Chart product name: TC Chart/);
  assert.match(landingSpecSource, /Hero section/);
  assert.match(landingSpecSource, /TC Chart feature highlights/);
  assert.match(landingSpecSource, /Subscription plans/);
  assert.match(landingSpecSource, /FAQ/);
  assert.match(landingSpecSource, /Contact actions/);
  assert.match(landingSpecSource, /Do not replace this section with start-route cards or a chart preview block/);
  assert.match(pageSource, /tcChartFeatures/);
  assert.match(pageSource, /from 'lucide-react'/);
  assert.match(pageSource, /type LucideIcon/);
  assert.match(pageSource, /const tcChartFeatureIcons/);
  assert.match(pageSource, /ChartNoAxesCombined/);
  assert.match(pageSource, /BellRing/);
  assert.match(pageSource, /Activity/);
  assert.match(pageSource, /FileChartColumn/);
  assert.match(pageSource, /landing-tc-chart-features/);
  assert.match(pageSource, /TC Chart Features/);
  assert.match(pageSource, /TradingCore \| 실시간 알고리즘 트레이딩 시그널/);
  assert.match(pageSource, /다중 지표 교차 검증을 통한 고정밀 시그널/);
  assert.doesNotMatch(pageSource, /TradingCore 차트/);
  assert.match(pageSource, /시장을 떠나 있어도 기회를 포착하는 실시간 알림 시스템/);
  assert.match(pageSource, /프로급 차트와 강력한 분석 도구 지원/);
  assert.match(pageSource, /신뢰할 수 있는 백테스팅 지표 공개/);
  assert.match(pageSource, /온사이트 실시간 알림/);
  assert.match(pageSource, /텔레그램 연동 지원/);
  assert.match(pageSource, /추세선·채널 작도/);
  assert.doesNotMatch(pageSource, /previewVolumes/);
  assert.doesNotMatch(pageSource, /chart-preview-command-panel/);
  assert.doesNotMatch(pageSource, /const iconSet = \[/);
  assert.match(cssSource, /\.landing-tc-chart-features/);
  assert.match(cssSource, /\.tc-chart-feature-grid/);
  assert.match(cssSource, /\.tc-chart-feature-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(cssSource, /\.tc-chart-feature-card/);
  assert.match(cssSource, /\.tc-chart-feature-card li::before/);
});

test('chart gate page uses TC Chart product copy instead of generic English gate labels', () => {
  const chartPageSource = fs.readFileSync(new URL('../app/chart/page.tsx', import.meta.url), 'utf8');

  assert.match(chartPageSource, /TC Chart/);
  assert.match(chartPageSource, /chart-gate-page/);
  assert.match(chartPageSource, /상단 메뉴 연결 정상/);
  assert.match(chartPageSource, /차트 페이지 진입 테스트가 가능한 상태입니다/);
  assert.match(chartPageSource, /차트 이용 권한/);
  assert.match(chartPageSource, /유료 시그널 열람/);
  assert.match(chartPageSource, /차트 엔진/);
  assert.match(chartPageSource, /기존 Vite 기반 TC Chart 코어/);
  assert.match(chartPageSource, /href="\/pricing"/);
  assert.match(chartPageSource, /href="\/profile"/);
  assert.doesNotMatch(chartPageSource, /TC 차트/);
  assert.doesNotMatch(chartPageSource, /Full chart/);
  assert.doesNotMatch(chartPageSource, /Paid signals/);
  assert.doesNotMatch(chartPageSource, /Chart engine/);
});

test('landing hero keeps internal access gate details out of the public view', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /landing-signal-card/);
  assert.doesNotMatch(pageSource, /marketTicker/);
  assert.doesNotMatch(pageSource, /market-console-tabs/);
  assert.doesNotMatch(pageSource, /market-ticker-strip/);
  assert.doesNotMatch(pageSource, /landing-hero-quick-note/);
  assert.doesNotMatch(pageSource, /Access Gate/);
  assert.doesNotMatch(pageSource, /BTCUSDT · Long Bias/);
  assert.doesNotMatch(cssSource, /\.landing-signal-card/);
  assert.doesNotMatch(cssSource, /\.market-console-tabs/);
  assert.doesNotMatch(cssSource, /\.market-ticker-strip/);
  assert.doesNotMatch(cssSource, /\.landing-hero-quick-note/);
  assert.doesNotMatch(cssSource, /@keyframes tickerPulse/);
  assert.doesNotMatch(pageSource, /signal-queue-panel/);
  assert.doesNotMatch(pageSource, /signalQueue/);
});

test('mobile landing hero centers slide artwork between copy and slide controls', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.landing-page \.landing-hero-bg\s*\{[\s\S]*?background-position:\s*center clamp\(218px, 42svh, 270px\)/);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.landing-page \.landing-hero-bg\s*\{[\s\S]*?background-size:\s*min\(74vw, 350px\) auto/);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.landing-page \.landing-hero-controls\s*\{[^}]*bottom: 44px/s);
});

test('landing middle sections present plan details without a workflow section', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /landingFlowCheckpoints/);
  assert.doesNotMatch(pageSource, /processSteps/);
  assert.doesNotMatch(pageSource, /landing-process/);
  assert.doesNotMatch(pageSource, /landing-flow-rail/);
  assert.match(pageSource, /landingPlanFeaturesById/);
  assert.match(pageSource, /getLandingPlanFeatures/);
  assert.match(pageSource, /formatLandingPlanPeriod/);
  assert.match(pageSource, /formatLandingPlanDiscount/);
  assert.match(pageSource, /\/ 매월/);
  assert.match(pageSource, /\/ 6개월/);
  assert.match(pageSource, /\/ 1년/);
  assert.match(pageSource, /landing-plan-feature-list/);
  assert.match(pageSource, /landing-plan-price-row/);
  assert.match(pageSource, /landing-plan-period/);
  assert.match(pageSource, /landing-plan-discount/);
  assert.match(pageSource, /landing-plan-card-header/);
  assert.match(pageSource, /formatLandingPlanIconType/);
  assert.match(pageSource, /renderLandingPlanIcon/);
  assert.match(pageSource, /className=\{`landing-plan-icon \$\{iconType\}`\}/);
  assert.match(pageSource, /<h3 className="landing-plan-title">[\s\S]*?\{renderLandingPlanIcon\(plan\)\}[\s\S]*?\{formatLandingPlanName\(plan\)\}/s);
  assert.match(pageSource, /\{featured \? <span className="landing-plan-badge">★ RECOMMENDED<\/span> : null\}/);
  assert.match(pageSource, /\$\{plan\.discountPercent\}% 할인/);
  assert.doesNotMatch(pageSource, /Member request/);
  assert.doesNotMatch(pageSource, /Admin deposit check/);
  assert.doesNotMatch(pageSource, /Subscription unlock/);
  assert.match(pageSource, /당신의 트레이딩 성향에 맞는 완벽한 플랜/);
  assert.match(pageSource, /실시간 온사이트 및 텔레그램 시그널 알림/);
  assert.match(pageSource, /텔레그램 알림 확장 및 교차 알림 커스텀/);
  assert.match(pageSource, /VIP 초고속 데이터 대역폭 및 우선 기술 지원/);
  assert.match(pageSource, /★ RECOMMENDED/);
  assert.doesNotMatch(pageSource, /Chart workspace/);
  assert.doesNotMatch(pageSource, /Signal unlock/);
  assert.doesNotMatch(pageSource, /Manual approval flow/);
  assert.match(cssSource, /\.landing-plan-feature-list/);
  assert.match(cssSource, /\.landing-plan-feature-list li::before/);
  assert.match(cssSource, /\.landing-plan-price-row/);
  assert.match(cssSource, /\.landing-plan-period/);
  assert.match(cssSource, /\.landing-plan-discount/);
  assert.match(cssSource, /\.landing-plan-card-header\s*\{[^}]*justify-content: space-between/s);
  assert.match(cssSource, /\.landing-plan-title\s*\{[^}]*display: inline-flex/s);
  assert.match(cssSource, /\.landing-plan-icon\s*\{[^}]*width: 34px/s);
  assert.match(cssSource, /\.landing-plan-icon\.basic/);
  assert.match(cssSource, /\.landing-plan-icon\.pro/);
  assert.match(cssSource, /\.landing-plan-icon\.elite/);
  assert.match(cssSource, /\.landing-plan-badge\s*\{[^}]*flex: 0 0 auto/s);
  assert.match(cssSource, /\.landing-plan-card-footer/);
});

test('landing plan cards use admin configured web info plan services', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /getAsyncWebInfoSettingsForDisplay/);
  assert.match(pageSource, /webInfoSettings: await getAsyncWebInfoSettingsForDisplay\(repository\)/);
  assert.match(pageSource, /const landingPlanFeatures = webInfoSettings\.planServices\[plan\.id\] \?\? getLandingPlanFeatures\(plan\);/);
  assert.match(pageSource, /landingPlanFeatures\.map\(\(feature\) =>/);
});

test('landing and pricing show BASIC plan period with a leading slash', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const pricingPanelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /plan\.id === 'plan_monthly'\) return '\/1개월'/);
  assert.match(pricingPanelSource, /plan\.id === 'plan_monthly'\) return '\/1개월'/);
  assert.doesNotMatch(pageSource, /plan\.id === 'plan_monthly'\) return '1개월'/);
  assert.doesNotMatch(pricingPanelSource, /plan\.id === 'plan_monthly'\) return '1개월'/);
});

test('landing and pricing plan prices format thousands and render decimal as subunit', async () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const pricingPanelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const { formatPlanPriceParts } = await import('../app/shared/plan-price-format.ts');

  assert.deepEqual(formatPlanPriceParts(1014.9), { currency: '$', whole: '1,014', fraction: '.9' });
  assert.deepEqual(formatPlanPriceParts(1671.6), { currency: '$', whole: '1,671', fraction: '.6' });
  assert.deepEqual(formatPlanPriceParts(199), { currency: '$', whole: '199', fraction: '' });
  assert.match(pageSource, /formatPlanPriceParts/);
  assert.match(pricingPanelSource, /formatPlanPriceParts/);
  assert.match(pageSource, /landing-plan-price-fraction/);
  assert.match(pricingPanelSource, /landing-plan-price-fraction/);
  assert.match(cssSource, /\.landing-plan-price-fraction\s*\{[^}]*font-size: 0\.6em/s);
});

test('landing bottom sections end with FAQ and contact actions', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /landingTrustBadges/);
  assert.doesNotMatch(pageSource, /landingFinalStats/);
  assert.doesNotMatch(pageSource, /landing-trust-badges/);
  assert.doesNotMatch(pageSource, /landing-final-metrics/);
  assert.doesNotMatch(pageSource, /Manual Deposit Check/);
  assert.doesNotMatch(pageSource, /Approval Flow/);
  assert.match(pageSource, /contactActionCards/);
  assert.match(pageSource, /landing-contact-actions/);
  assert.match(pageSource, /\/support\?category=partnership/);
  assert.match(pageSource, /FreeTrialRequestButton/);
  assert.match(pageSource, /href: 'free-trial'/);
  assert.match(pageSource, /1:1 문의하기/);
  assert.match(pageSource, /제휴 문의하기/);
  assert.match(pageSource, /무료체험 신청/);
  assert.match(pageSource, /TradingCore는 초보 투자자도 바로 사용할 수 있나요/);
  assert.match(pageSource, /시그널이 지원하는 투자 상품이나 시장은 무엇인가요/);
  assert.match(pageSource, /텔레그램 실시간 알림 연동은 어렵지 않나요/);
  assert.match(cssSource, /\.landing-contact-actions/);
  assert.match(cssSource, /\.landing-contact-grid/);
  assert.match(cssSource, /\.landing-contact-card/);
  assert.match(cssSource, /Contact section final blue system pass/);
  assert.match(cssSource, /\.landing-page \.landing-contact-card \.button\.secondary\s*\{[^}]*rgba\(86, 240, 255, 0\.09\)/s);
  assert.match(cssSource, /\.landing-page \.landing-contact-actions\s*\{[^}]*rgba\(7, 21, 47, 0\.9\)/s);
  assert.match(cssSource, /\.landing-page \.landing-contact-card span\s*\{[^}]*var\(--tradingcore-azure\)/s);
  assert.match(cssSource, /\.landing-faq-card::before/);
  assert.match(cssSource, /\.landing-footer::before/);
});

test('landing page removes start route cards in favor of the TradingCore feature section', () => {
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /conversionRouteCards/);
  assert.doesNotMatch(pageSource, /landing-conversion-routes/);
  assert.doesNotMatch(pageSource, /3가지 시작 경로/);
  assert.doesNotMatch(pageSource, /무료체험으로 먼저 확인/);
  assert.doesNotMatch(pageSource, /차트 미리보기 바로 열기/);
  assert.match(pageSource, /tcChartFeatures/);
  assert.match(pageSource, /landing-tc-chart-features/);
  assert.match(pageSource, /href="#landing-tc-chart-features"/);
  assert.match(cssSource, /\.landing-tc-chart-features/);
  assert.match(cssSource, /\.tc-chart-feature-grid/);
  assert.match(cssSource, /\.tc-chart-feature-card/);
});

test('landing page uses a premium dark brokerage palette without cloning another layout', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

  assert.match(cssSource, /@font-face\s*\{[^}]*font-family: "Pretendard"[^}]*PretendardVariable\.woff2/s);
  assert.match(cssSource, /font-weight: 100 900/);
  assert.match(cssSource, /font-display: swap/);
  assert.match(cssSource, /font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif/);
  assert.match(cssSource, /--tradingcore-navy: #07152f/);
  assert.match(cssSource, /--tradingcore-midnight: #020713/);
  assert.match(cssSource, /--tradingcore-carbon: #08111f/);
  assert.match(cssSource, /--tradingcore-blue: #1359ff/);
  assert.match(cssSource, /--tradingcore-electric: #4c8dff/);
  assert.match(cssSource, /--tradingcore-azure: #7db7ff/);
  assert.match(cssSource, /\.landing-page \{/);
  assert.match(cssSource, /\.landing-page::after/);
  assert.match(cssSource, /\.landing-hero-stage/);
  assert.match(cssSource, /\.landing-hero-stage::before/);
  assert.match(cssSource, /\.landing-hero-copy/);
  assert.doesNotMatch(cssSource, /\.landing-hero-status-pills/);
  assert.match(cssSource, /\.landing-contact-card/);
  assert.match(cssSource, /linear-gradient\(180deg, #020713 0%, #061327 48%, #020713 100%\)/);
  assert.match(cssSource, /rgba\(255, 255, 255, 0\.08/);
  assert.match(cssSource, /rgba\(19, 89, 255, 0\.24/);
  assert.match(cssSource, /var\(--tradingcore-blue\)/);
  assert.match(cssSource, /var\(--tradingcore-electric\)/);
  assert.match(cssSource, /var\(--tradingcore-azure\)/);
  assert.match(cssSource, /Premium blue brokerage landing correction/);
  assert.match(cssSource, /TC Chart Features blue cleanup/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card::before/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card::after/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card span/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card li::before/);
  assert.match(cssSource, /Keep TC Chart feature card typography crisp during scroll reveal/);
  assert.match(cssSource, /Feature cards stay fully sharp; section motion stays disabled/);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card\s*\{[^}]*animation: none/s);
  assert.match(cssSource, /\.tc-chart-feature-card > \*\s*\{[^}]*z-index: 1/s);
  assert.match(cssSource, /\.landing-page \.tc-chart-feature-card h3\s*\{[^}]*color: #ffffff/s);
  assert.match(cssSource, /\.landing-page \.button/);
  assert.match(cssSource, /\.landing-page \.button\.secondary/);
  assert.match(cssSource, /\.tc-chart-feature-card/);
  assert.match(cssSource, /\.landing-mobile-cta/);
  assert.doesNotMatch(pageSource, /FundedNext/i);
  assert.doesNotMatch(cssSource, /FundedNext/i);
  assert.doesNotMatch(pageSource, /Hedgehood/i);
  assert.doesNotMatch(cssSource, /Hedgehood/i);
});

test('pricing copy makes deposit confirmation explicitly manual', () => {
  const pageSource = fs.readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /pricing-page-hero/);
  assert.match(cssSource, /\.pricing-page\s*\{[^}]*display: grid/s);
  assert.match(cssSource, /\.pricing-page\s*\{[^}]*justify-content: center/s);
  assert.match(cssSource, /\.pricing-page-hero\s*\{[^}]*max-width: 1180px/s);
  assert.match(cssSource, /\.pricing-checkout-card\s*\{[^}]*max-width: 1320px/s);
  assert.match(cssSource, /\.pricing-checkout-card\s*\{[^}]*width: 100%/s);
  assert.doesNotMatch(pageSource, /pricingFlowSteps/);
  assert.doesNotMatch(pageSource, /pricing-flow-summary/);
  assert.doesNotMatch(pageSource, /pricing-plan-summary-grid/);
  assert.doesNotMatch(pageSource, /formatPricingPlanName/);
  assert.match(pageSource, /getAsyncWebInfoSettingsForDisplay/);
  assert.doesNotMatch(pageSource, /getPricingPlanServices/);
  assert.match(pageSource, /webInfoSettings\.planServices/);
  assert.doesNotMatch(pageSource, /pricing-service-list/);
  assert.match(panelSource, /TC Chart 접근/);
  assert.match(panelSource, /유료 시그널 열람/);
  assert.match(panelSource, /마이프로필 구독 상태 확인/);
  assert.match(panelSource, /BASIC/);
  assert.match(panelSource, /PRO/);
  assert.match(panelSource, /ELITE/);
  assert.match(pageSource, /입금확인 요청/);
  assert.match(pageSource, /구독을 승인/);
  assert.match(pageSource, /관리자가 실제 입금 내역을 수동 확인/);
  assert.match(panelSource, /관리자 수동 입금 확인/);
  assert.match(panelSource, /dispatchNotificationsRefreshEvent/);
  assert.doesNotMatch(panelSource, /pricing-checkout-trust-strip/);
  assert.doesNotMatch(panelSource, /상태 알림 발송/);
  assert.doesNotMatch(panelSource, /1:1 요청 연결/);
  assert.doesNotMatch(panelSource, /pricing-auth-cta/);
  assert.match(panelSource, /로그인 후 플랜 신청이 가능합니다/);
  assert.match(panelSource, /AuthPromptModal/);
  assert.match(panelSource, /loginHref="\/login\?redirect=\/pricing"/);
  assert.match(panelSource, /signupHref="\/signup\?redirect=\/pricing"/);
  assert.match(cssSource, /\.button\.subtle/);
  assert.doesNotMatch(pageSource, /<table className="table">/);
  assert.doesNotMatch(pageSource, /자동 입금 확인/);
  assert.doesNotMatch(panelSource, /자동 입금 확인/);
});

test('pricing payment request shows admin configured bank and USDT transfer instructions', () => {
  const pageSource = fs.readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /getAsyncPaymentTransferSettingsForDisplay/);
  assert.match(pageSource, /paymentSettings=\{paymentSettings\}/);
  assert.match(panelSource, /paymentMethod/);
  assert.match(panelSource, /bankAccountNumber/);
  assert.match(panelSource, /bankAccountHolder/);
  assert.match(panelSource, /bankLogoUrl/);
  assert.match(panelSource, /bank-logo-image/);
  assert.match(panelSource, /usdtAddress/);
  assert.match(panelSource, /usdtNetwork/);
  assert.match(panelSource, /method: paymentMethod/);
});

test('pricing payment method switches with bank and crypto tabs instead of a select', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /payment-method-tabs/);
  assert.match(panelSource, /은행이체/);
  assert.match(panelSource, /가상화폐/);
  assert.match(panelSource, /aria-pressed=\{paymentMethod === 'bank_transfer'\}/);
  assert.match(panelSource, /aria-pressed=\{paymentMethod === 'usdt'\}/);
  assert.doesNotMatch(panelSource, /<select[\s\S]*id="paymentMethod"/);
  assert.match(cssSource, /\.payment-method-tabs/);
});

test('pricing payment method details keep a stable height across tabs', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const transferInfoStyle = cssSource.match(/\.payment-transfer-info\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

  assert.match(transferInfoStyle, /box-sizing:\s*border-box/);
  assert.match(transferInfoStyle, /align-content:\s*start/);
  assert.match(transferInfoStyle, /height:\s*264px/);
  assert.match(transferInfoStyle, /min-height:\s*264px/);
  assert.match(transferInfoStyle, /overflow:\s*auto/);
});

test('pricing bank transfer shows Naver exchange rate KRW amount and submits the rate', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /\/api\/exchange-rate\/usd-krw/);
  assert.match(panelSource, /naverExchangeRate/);
  assert.match(panelSource, /selectedPlanAmountKrw/);
  assert.match(panelSource, /네이버 환율/);
  assert.match(panelSource, /결제금액/);
  assert.match(panelSource, /exchangeRate: paymentMethod === 'bank_transfer'/);
});

test('pricing bank transfer blocks the next step until depositor name is entered', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /depositorNameInputRef/);
  assert.match(panelSource, /validateBankTransferDepositorName/);
  assert.match(panelSource, /paymentMethod !== 'bank_transfer' \|\| depositorName\.trim\(\)/);
  assert.match(panelSource, /window\.alert\(alertMessage\)/);
  assert.match(panelSource, /입금자명을 입력해야 다음 단계로 진행할 수 있습니다/);
  assert.match(panelSource, /depositorNameInputRef\.current\?\.focus\(\)/);
  assert.match(panelSource, /ref=\{depositorNameInputRef\}/);
  assert.match(panelSource, /depositorName: paymentMethod === 'bank_transfer' \? depositorName\.trim\(\) : depositorName/);
});

test('pricing payment request errors are shown with an alert', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /const errorMessage = payload\.message \|\| '결제 요청에 실패했습니다\. 먼저 로그인해 주세요\.'/);
  assert.match(panelSource, /window\.alert\(errorMessage\)/);
  assert.match(panelSource, /setMessage\(errorMessage\)/);
});

test('pricing USDT payment request captures and submits the TXID value', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /transactionId/);
  assert.match(panelSource, /id="transactionId"/);
  assert.match(panelSource, /paymentMethod === 'usdt'/);
  assert.match(panelSource, /body: JSON\.stringify\(\{/);
});

test('pricing USDT payment method shows the required transfer quantity', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /selectedPlanAmountUsd=\{selectedPlanAmountUsd\}/);
  assert.match(panelSource, /formatUsdtTransferQuantity\(selectedPlanAmountUsd\)/);
  assert.match(panelSource, /USDT 전송 수량/);
  assert.match(panelSource, /usdt-payment-amount/);
  assert.match(cssSource, /\.usdt-payment-amount/);
});

test('pricing payment request lets members choose a subscription plan from cards', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /pricing-plan-selection-grid/);
  assert.match(panelSource, /pricing-plan-card/);
  assert.match(panelSource, /type="radio"/);
  assert.match(panelSource, /checked=\{selectedPlanId === plan\.id\}/);
  assert.match(panelSource, /onChange=\{\(\) => setSelectedPlanId\(plan\.id\)\}/);
  assert.match(panelSource, /discountedAmount\(plan\)/);
  assert.doesNotMatch(panelSource, /<select id="planId"/);
  assert.match(cssSource, /\.pricing-plan-selection-grid/);
  assert.match(cssSource, /\.pricing-checkout-card \.pricing-plan-card\.selected/);
});

test('pricing plan cards place selection buttons inside each card and highlight the half-year plan', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /isRecommendedPlan\(plan\)/);
  assert.match(panelSource, /plan\.id === 'plan_half_year'/);
  assert.match(panelSource, /formatPricingLandingPlanName/);
  assert.match(panelSource, /getCheckoutPlanServices/);
  assert.match(panelSource, /planServices/);
  assert.match(panelSource, /landing-plan-feature-list/);
  assert.match(panelSource, /BASIC/);
  assert.match(panelSource, /PRO/);
  assert.match(panelSource, /ELITE/);
  assert.match(panelSource, /formatPricingLandingPlanName\(plan\)/);
  assert.match(panelSource, /formatCheckoutPlanName\(selectedPlan\)/);
  assert.match(panelSource, /landing-plan-card-footer/);
  assert.match(panelSource, /추천 플랜/);
  assert.match(panelSource, /플랜 선택하기/);
  assert.match(panelSource, /선택됨/);
  assert.match(cssSource, /\.pricing-checkout-card \.pricing-plan-card\.featured/);
  assert.match(cssSource, /\.landing-plan-badge/);
  assert.match(cssSource, /\.pricing-checkout-card \.pricing-plan-card \.button/);
});

test('pricing plan selection has roomier desktop card columns', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const planSelectionRule = cssSource.match(/body:not\(:has\(\.landing-page\)\) \.pricing-plan-selection-grid\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const planCardRule = cssSource.match(/body:not\(:has\(\.landing-page\)\) \.pricing-checkout-card \.pricing-plan-card\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

  assert.match(planSelectionRule, /grid-template-columns:\s*repeat\(3, minmax\(260px, 1fr\)\)/);
  assert.match(planSelectionRule, /gap:\s*18px/);
  assert.match(planCardRule, /padding:\s*22px/);
  assert.match(
    cssSource,
    /@media \(max-width: 900px\)[\s\S]*?body:not\(:has\(\.landing-page\)\) \.pricing-plan-selection-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr[\s\S]*?gap:\s*14px/,
  );
});

test('pricing selected plan buttons stay inside responsive plan cards', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const pricingPlanButtonStyle = cssSource.match(/body:not\(:has\(\.landing-page\)\) \.pricing-checkout-card \.pricing-plan-card \.button\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

  assert.match(pricingPlanButtonStyle, /box-sizing:\s*border-box/);
  assert.match(pricingPlanButtonStyle, /max-width:\s*100%/);
  assert.match(pricingPlanButtonStyle, /min-width:\s*0/);
});

test('pricing payment request advances through step-based checkout states', () => {
  const panelSource = fs.readFileSync(new URL('../app/pricing/pricing-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /type CheckoutStep = 'plan' \| 'payment' \| 'confirm' \| 'submitted'/);
  assert.match(panelSource, /checkoutStep/);
  assert.match(panelSource, /setCheckoutStep\('payment'\)/);
  assert.match(panelSource, /setCheckoutStep\('confirm'\)/);
  assert.match(panelSource, /setCheckoutStep\('submitted'\)/);
  assert.equal((panelSource.match(/>\s*다음\s*<\/button>/g) ?? []).length, 2);
  assert.match(panelSource, /플랜 선택/);
  assert.match(panelSource, /결제방식 및 결제금액 확인/);
  assert.match(panelSource, /구독확정/);
  assert.match(panelSource, /입금확인 요청 완료/);
  assert.match(panelSource, /입금확인 및 승인 대기합니다\./);
  assert.match(panelSource, /checkout-stepper/);
  assert.match(cssSource, /\.checkout-stepper/);
  assert.match(cssSource, /\.checkout-step-panel/);
  assert.match(cssSource, /\.checkout-confirm-grid/);
});

test('service copy does not keep mojibake fragments in app-facing files', () => {
  const roots = [
    new URL('../app/', import.meta.url),
    new URL('../src/', import.meta.url),
  ];
  const extensions = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
  const offenders = [];

  function walk(directoryUrl) {
    for (const entry of fs.readdirSync(directoryUrl, { withFileTypes: true })) {
      const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);
      if (entry.isDirectory()) {
        walk(entryUrl);
        continue;
      }
      if (!extensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) continue;

      const source = fs.readFileSync(entryUrl, 'utf8');
      source.split(/\r?\n/).forEach((line, index) => {
        if (/[\u4e00-\u9fff\uf900-\ufaff\ufffd]/u.test(line)) {
          offenders.push(`${entryUrl.pathname}:${index + 1}`);
        }
      });
    }
  }

  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});

test('admin payment settings panel and route are wired into operations UI', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const webInfoSectionSource = fs.readFileSync(new URL('../app/admin/admin-web-info-section.tsx', import.meta.url), 'utf8');
  const sectionsSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-sections.ts', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-payment-settings-panel.tsx', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/admin/payment-settings/route.ts', import.meta.url), 'utf8');

  assert.match(webInfoSectionSource, /AdminPaymentSettingsPanel/);
  assert.doesNotMatch(pageSource, /sectionKey="paymentSettings"/);
  assert.match(pageSource, /sectionKey="webInfo"[\s\S]*AdminWebInfoSection/);
  assert.match(webInfoSectionSource, /activePage === 'payments'/);
  assert.match(sectionsSource, /입금정보관리/);
  assert.match(sectionsSource, /href: '#admin-payment-settings'/);
  assert.doesNotMatch(sectionsSource, /key: 'paymentSettings'/);
  assert.match(panelSource, /admin-payment-settings/);
  assert.match(panelSource, /handleBankLogoUpload/);
  assert.match(panelSource, /readBankLogoFileAsDataUrl/);
  assert.match(panelSource, /type="file"/);
  assert.match(panelSource, /accept=\{BANK_LOGO_UPLOAD_ACCEPT\}/);
  assert.match(panelSource, /bank-logo-preview/);
  assert.match(panelSource, /bankAccountNumber/);
  assert.match(panelSource, /bankAccountHolder/);
  assert.match(panelSource, /bankLogoUrl/);
  assert.match(panelSource, /usdtAddress/);
  assert.match(panelSource, /usdtNetwork/);
  assert.doesNotMatch(panelSource, /BANK_LOGO_PRESETS/);
  assert.match(routeSource, /updateAsyncPaymentTransferSettings/);
});

test('admin payment panel exposes USDT TXID for manual confirmation', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /transactionId/);
  assert.match(source, /TXID/);
});

test('admin payment panel exposes TronScan verification controls for USDT TXIDs', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /transactionVerificationStatus/);
  assert.match(source, /renderTransactionVerificationBadge/);
  assert.match(source, /verifyTransactionId/);
  assert.match(source, /\/api\/admin\/payments\/verify-txid/);
  assert.match(source, /createTronScanTransactionUrl/);
  assert.match(source, /txid-verification-badge/);
  assert.match(source, /TronScan/);
});

test('admin payment panel refreshes its filtered queue after local operations without overwriting success context', () => {
  const source = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type AdminPanelRefreshOptions = \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'payments'/);
  assert.match(source, /void refresh\(\{ nextMessage: `\$\{paymentId\} 작업이 반영되었습니다\. 목록을 갱신했습니다\.` \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'payments' \}\)/);
});
