import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createAuditLogDraft } from '../src/domain/chart-service/index.ts';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  createSupportThread,
  getAdminDashboardSummary,
  getChartServiceRepository,
  requestSubscriptionRefund,
  SESSION_COOKIE_NAME,
  updateAdminUserAccountStatus,
} from '../src/server/chart-service/index.ts';

test('admin dashboard summary counts operational queues and service state', () => {
  const repository = createMockChartServiceRepository();
  requestSubscriptionRefund(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T14:20:00.000Z',
  });
  createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '입금 확인 요청',
    body: '입금 확인 부탁드립니다.',
    visibility: 'private',
    createdAt: '2026-05-23T14:21:00.000Z',
  });
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'dashboard.test',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: {},
    afterJson: {},
  }));
  updateAdminUserAccountStatus(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_member',
    accountStatus: 'suspended',
    reason: 'risk review',
  });
  const withdrawn = repository.getUserById('user_trial');
  assert.ok(withdrawn);
  repository.saveUser({
    ...withdrawn,
    accountStatus: 'suspended',
    passwordHash: null,
  });

  const summary = getAdminDashboardSummary(repository);

  assert.equal(summary.users.totalCount, 5);
  assert.equal(summary.users.activeCount, 3);
  assert.equal(summary.users.suspendedCount, 1);
  assert.equal(summary.users.adminCount, 2);
  assert.equal(summary.payments.totalCount, 2);
  assert.equal(summary.payments.pendingCount, 1);
  assert.equal(summary.payments.confirmedCount, 1);
  assert.equal(summary.payments.queueCount, 2);
  assert.equal(summary.subscriptions.paymentPendingCount, 1);
  assert.equal(summary.subscriptions.refundRequestedCount, 1);
  assert.equal(summary.subscriptions.queueCount, 2);
  assert.equal(summary.support.waitingCount, 1);
  assert.equal(summary.support.privateCount, 1);
  assert.equal(summary.audit.totalCount, 2);
});

test('admin dashboard API requires an admin session and returns the summary', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { GET } = await import('../app/api/admin/dashboard/route.ts');

  const denied = await GET(new Request('http://localhost/api/admin/dashboard'));
  const allowed = await GET(new Request('http://localhost/api/admin/dashboard', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
  }));
  const payload = await allowed.json();

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.summary.payments.pendingCount, 'number');
  assert.equal(typeof payload.summary.subscriptions.queueCount, 'number');
  assert.equal(typeof payload.summary.support.waitingCount, 'number');
  assert.equal(typeof payload.summary.users.suspendedCount, 'number');
});

test('admin dashboard panel renders the priority action with anchored admin sections', () => {
  const dashboardSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-panel.tsx', import.meta.url), 'utf8');
  const paymentSource = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const subscriptionSource = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');
  const supportSource = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');
  const auditSource = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(dashboardSource, /getAdminDashboardPriority/);
  assert.match(dashboardSource, /getAdminDashboardQueueItems/);
  assert.match(dashboardSource, /dispatchAdminQueuePresetEvent/);
  assert.match(dashboardSource, /dispatchAdminAuditLogPresetEvent/);
  assert.match(dashboardSource, /dispatchPriorityQueuePreset/);
  assert.match(dashboardSource, /panel: priority\.panel/);
  assert.match(dashboardSource, /presetKey: priority\.presetKey/);
  assert.match(dashboardSource, /처리 대기 큐/);
  assert.match(dashboardSource, /queueItems\.map/);
  assert.match(dashboardSource, /dashboard-queue-meta/);
  assert.match(dashboardSource, /item\.actionLabel/);
  assert.match(dashboardSource, /item\.filterLabel/);
  assert.match(dashboardSource, /panel: item\.panel/);
  assert.match(dashboardSource, /presetKey: item\.presetKey/);
  assert.match(dashboardSource, /summary\.users\.suspendedCount/);
  assert.match(dashboardSource, /dashboard-audit-card/);
  assert.match(dashboardSource, /href="#admin-audit-logs"/);
  assert.match(dashboardSource, /dispatchAdminAuditLogPresetEvent\(\{ presetKey: 'all' \}\)/);
  assert.match(dashboardSource, /회원 상태/);
  assert.match(dashboardSource, /className=\{`dashboard-priority/);
  assert.match(dashboardSource, /href=\{priority\.href\}/);
  assert.match(paymentSource, /id="admin-payments"/);
  assert.match(subscriptionSource, /id="admin-subscriptions"/);
  assert.match(supportSource, /id="admin-support"/);
  assert.match(auditSource, /id="admin-audit-logs"/);
  assert.match(userSource, /id="admin-users"/);
});

test('admin operation lists paginate queues ten items at a time', () => {
  const paymentSource = fs.readFileSync(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8');
  const subscriptionSource = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');
  const supportSource = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');
  const auditSource = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(paymentSource, /ADMIN_PAYMENT_PAGE_SIZE = 10/);
  assert.match(paymentSource, /paginatedPayments/);
  assert.match(paymentSource, /admin-pagination/);
  assert.match(paymentSource, /filteredPayments\.slice/);

  assert.match(subscriptionSource, /ADMIN_SUBSCRIPTION_PAGE_SIZE = 10/);
  assert.match(subscriptionSource, /paginatedItems/);
  assert.match(subscriptionSource, /admin-pagination/);
  assert.match(subscriptionSource, /filteredItems\.slice/);

  assert.match(supportSource, /ADMIN_SUPPORT_THREAD_PAGE_SIZE = 10/);
  assert.match(supportSource, /paginatedThreads/);
  assert.match(supportSource, /admin-pagination/);
  assert.match(supportSource, /filteredThreads\.slice/);

  assert.match(auditSource, /ADMIN_AUDIT_LOG_PAGE_SIZE = 10/);
  assert.match(auditSource, /paginatedEntries/);
  assert.match(auditSource, /admin-pagination/);
  assert.match(auditSource, /entries\.slice/);

  assert.match(userSource, /ADMIN_USER_PAGE_SIZE = 10/);
  assert.match(userSource, /paginatedUsers/);
  assert.match(userSource, /admin-pagination/);
  assert.match(userSource, /users\.slice/);

  assert.match(styleSource, /\.admin-pagination/);
  assert.match(styleSource, /\.admin-pagination-button/);
});

test('admin dashboard summary cards route directly to each operation filter', () => {
  const dashboardSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-panel.tsx', import.meta.url), 'utf8');

  assert.match(dashboardSource, /dashboard-payment-card/);
  assert.match(dashboardSource, /href="#admin-payments"/);
  assert.match(dashboardSource, /dispatchAdminQueuePresetEvent\(\{\s*panel: 'payments',\s*presetKey: 'pending',\s*\}\)/);
  assert.match(dashboardSource, /dashboard-subscription-card/);
  assert.match(dashboardSource, /href="#admin-subscriptions"/);
  assert.match(dashboardSource, /dispatchAdminQueuePresetEvent\(\{\s*panel: 'subscriptions',\s*presetKey: 'all',\s*\}\)/);
  assert.match(dashboardSource, /dashboard-support-card/);
  assert.match(dashboardSource, /href="#admin-support"/);
  assert.match(dashboardSource, /dispatchAdminQueuePresetEvent\(\{\s*panel: 'support',\s*presetKey: 'waiting',\s*\}\)/);
  assert.match(dashboardSource, /dashboard-user-card/);
  assert.match(dashboardSource, /href="#admin-users"/);
  assert.match(dashboardSource, /dispatchAdminQueuePresetEvent\(\{\s*panel: 'users',\s*presetKey: 'suspended',\s*\}\)/);
});

test('admin dashboard operation cards use large contextual background marks', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const summaryCardRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-overview \.dashboard-summary-card\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const operationMarkRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-overview \.dashboard-payment-card::after,[\s\S]*?body:not\(:has\(\.landing-page\)\) #admin-overview \.dashboard-audit-card::after\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(summaryCardRule, /position:\s*relative/);
  assert.match(summaryCardRule, /overflow:\s*hidden/);
  assert.match(cssSource, /dashboard-payment-card::after/);
  assert.match(cssSource, /dashboard-subscription-card::after/);
  assert.match(cssSource, /dashboard-support-card::after/);
  assert.match(cssSource, /dashboard-user-card::after/);
  assert.match(cssSource, /dashboard-audit-card::after/);
  assert.match(operationMarkRule, /height:\s*96px/);
  assert.match(operationMarkRule, /width:\s*96px/);
  assert.match(operationMarkRule, /right:\s*18px/);
  assert.match(operationMarkRule, /z-index:\s*0/);
  assert.match(cssSource, /dashboard-payment-card::after\s*\{[\s\S]*?mask:\s*url\("data:image\/svg\+xml/);
  assert.match(cssSource, /dashboard-subscription-card::after\s*\{[\s\S]*?mask:\s*url\("data:image\/svg\+xml/);
  assert.match(cssSource, /dashboard-subscription-card::after\s*\{[\s\S]*?M11 10v4h4/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?mask:\s*url\("data:image\/svg\+xml/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?-webkit-mask:\s*url\("data:image\/svg\+xml/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?M10 22C14\.4183 22/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?M18 14\.5018/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?M6\.51828 14H6\.52728/);
  assert.match(cssSource, /dashboard-support-card::after\s*\{[\s\S]*?background:\s*rgba\(125, 183, 255, 0\.17\)/);
  assert.match(cssSource, /dashboard-user-card::after\s*\{[\s\S]*?mask:\s*url\("data:image\/svg\+xml/);
  assert.match(cssSource, /dashboard-audit-card::after\s*\{[\s\S]*?mask:\s*url\("data:image\/svg\+xml/);
});
