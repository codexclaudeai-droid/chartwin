import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  createSessionForUser,
  getAsyncAdminUserDirectory,
  getAdminUserDirectory,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAdminUserAccountStatus,
  updateAdminUserEmail,
} from '../src/server/chart-service/index.ts';

test('admin user directory filters users and attaches operational account state', () => {
  const repository = createMockChartServiceRepository();

  const result = getAdminUserDirectory(repository, { query: 'subscriber' });

  assert.equal(result.length, 1);
  assert.equal(result[0].user.email, 'subscriber@example.com');
  assert.equal(result[0].subscription?.status, 'active');
  assert.equal(result[0].latestPayment?.status, 'confirmed');
  assert.equal(result[0].paymentCount, 1);
  assert.equal(result[0].access.fullChart, true);
  assert.equal(result[0].access.paidSignals, true);
});

test('admin user directory includes contact referral and signup metadata', () => {
  const repository = createMockChartServiceRepository();

  const result = getAdminUserDirectory(repository, { query: 'member' });
  const member = result.find((item) => item.user.email === 'member@example.com');

  assert.equal(member?.user.name, 'Member');
  assert.equal(member?.user.email, 'member@example.com');
  assert.equal(member?.user.phoneNumber, '010-1000-2000');
  assert.equal(member?.referrer?.email, 'subscriber@example.com');
  assert.equal(member?.user.createdAt, '2026-05-23T00:00:00.000Z');
});

test('admin user directory orders members by newest signup first', async () => {
  const repository = createMockChartServiceRepository();
  const baseUser = repository.getUserById('user_member');
  assert.ok(baseUser);

  repository.saveUser({
    ...baseUser,
    id: 'user_sort_old',
    email: 'old-sort@example.com',
    name: 'Old Sort',
    referralCode: 'OLDSRT',
    createdAt: '2026-05-24T00:00:00.000Z',
  });
  repository.saveUser({
    ...baseUser,
    id: 'user_sort_new',
    email: 'new-sort@example.com',
    name: 'New Sort',
    referralCode: 'NEWSRT',
    createdAt: '2026-05-26T00:00:00.000Z',
  });

  const syncResult = getAdminUserDirectory(repository);
  assert.equal(syncResult[0].user.email, 'new-sort@example.com');
  assert.equal(syncResult.findIndex((item) => item.user.email === 'new-sort@example.com') <
    syncResult.findIndex((item) => item.user.email === 'old-sort@example.com'), true);

  const asyncResult = await getAsyncAdminUserDirectory(createAsyncChartServiceRepository(repository));
  assert.equal(asyncResult[0].user.email, 'new-sort@example.com');
  assert.equal(asyncResult.findIndex((item) => item.user.email === 'new-sort@example.com') <
    asyncResult.findIndex((item) => item.user.email === 'old-sort@example.com'), true);
});

test('admin user directory can filter by role without hiding subscription state', () => {
  const repository = createMockChartServiceRepository();

  const admins = getAdminUserDirectory(repository, { role: 'admin' });
  const members = getAdminUserDirectory(repository, { role: 'member' });

  assert.equal(admins.length, 1);
  assert.equal(admins[0].user.email, 'admin@example.com');
  assert.equal(members.length, 3);
  assert.equal(members.some((item) => item.subscription?.status === 'payment_pending'), true);
  assert.equal(members.some((item) => item.subscription?.status === 'trial_active'), true);
});

test('admin user directory can filter by account status', () => {
  const repository = createMockChartServiceRepository();
  updateAdminUserAccountStatus(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_member',
    accountStatus: 'suspended',
    reason: 'risk review',
  });

  const suspended = getAdminUserDirectory(repository, { accountStatus: 'suspended' });
  const active = getAdminUserDirectory(repository, { accountStatus: 'active' });

  assert.equal(suspended.length, 1);
  assert.equal(suspended[0].user.email, 'member@example.com');
  assert.equal(active.some((item) => item.user.email === 'member@example.com'), false);
  assert.equal(active.every((item) => item.user.accountStatus === 'active'), true);
});

test('only super admins can change a user login email and the change is audited', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAdminUserEmail(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    email: 'new-member@example.com',
  }), /Super admin role required/);

  const detail = updateAdminUserEmail(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_member',
    email: ' New-Member@Example.com ',
  });
  const auditLog = repository.listAuditLogs().at(-1);

  assert.equal(detail.user.email, 'new-member@example.com');
  assert.equal(repository.getUserById('user_member')?.email, 'new-member@example.com');
  assert.equal(auditLog?.action, 'admin.user.email.update');
  assert.equal(auditLog?.actorAdminId, 'super_1');
  assert.equal(auditLog?.targetId, 'user_member');
  assert.deepEqual(auditLog?.afterJson, {
    user: {
      ...repository.getUserById('user_member'),
    },
    previousEmail: 'member@example.com',
    nextEmail: 'new-member@example.com',
  });
});

test('admin user email changes reject invalid or duplicate addresses', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAdminUserEmail(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_member',
    email: 'not-an-email',
  }), /Valid email required/);

  assert.throws(() => updateAdminUserEmail(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_member',
    email: 'ADMIN@EXAMPLE.COM',
  }), /Email already in use/);
});

test('admin users API accepts an account status filter', async () => {
  const repository = getChartServiceRepository();
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  updateAdminUserAccountStatus(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_trial',
    accountStatus: 'suspended',
    reason: 'risk review',
  });
  const { GET } = await import('../app/api/admin/users/route.ts');

  const response = await GET(new Request('http://localhost/api/admin/users?accountStatus=suspended', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${superSession.id}` },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.users.every((item) => item.user.accountStatus === 'suspended'), true);
  assert.equal(payload.users.some((item) => item.user.email === 'trial@example.com'), true);
});

test('admin user detail API lets only super admins change login email', async () => {
  const repository = getChartServiceRepository();
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { PATCH } = await import('../app/api/admin/users/[id]/route.ts');

  const denied = await PATCH(new Request('http://localhost/api/admin/users/user_trial', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'trial-renamed@example.com' }),
  }), { params: Promise.resolve({ id: 'user_trial' }) });
  const allowed = await PATCH(new Request('http://localhost/api/admin/users/user_trial', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'trial-renamed@example.com' }),
  }), { params: Promise.resolve({ id: 'user_trial' }) });
  const payload = await allowed.json();

  assert.equal(denied.status, 403);
  assert.equal(allowed.status, 200);
  assert.equal(payload.detail.user.email, 'trial-renamed@example.com');
  updateAdminUserEmail(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    userId: 'user_trial',
    email: 'trial@example.com',
  });
});

test('admin users API requires admin session and supports query filtering', async () => {
  const repository = getChartServiceRepository();
  const memberSession = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET } = await import('../app/api/admin/users/route.ts');

  const memberDenied = await GET(new Request('http://localhost/api/admin/users', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberSession.id}` },
  }));
  const allowed = await GET(new Request('http://localhost/api/admin/users?query=trial', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const payload = await allowed.json();

  assert.equal(memberDenied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.users.length, 1);
  assert.equal(payload.users[0].user.email, 'trial@example.com');
  assert.equal(payload.users[0].user.passwordHash, undefined);
  assert.equal(payload.users[0].subscription.status, 'trial_active');
});

test('admin user panel renders operator-friendly user state labels', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatUserRoleLabel/);
  assert.match(source, /formatUserAccountStatusLabel/);
  assert.doesNotMatch(source, /\{item\.user\.role\}/);
  assert.doesNotMatch(source, /\{item\.user\.accountStatus\}/);
});

test('admin user panel shows the subscription plan tier beside subscription status', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatAdminPlanTierLabel/);
  assert.match(source, /formatAdminPlanTierLabel\(item\.subscription/);
  assert.match(source, /formatAdminPlanTierLabel\(detail\.subscription/);
  assert.match(source, /admin-user-plan-badge/);
});

test('admin user panel renders member contact referral and signup metadata in the member column', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /<th>연락번호<\/th>/);
  assert.doesNotMatch(source, /<th>추천인<\/th>/);
  assert.doesNotMatch(source, /<th>가입일<\/th>/);
  assert.match(source, /className="member-directory-cell"/);
  assert.match(source, /<span>연락번호/);
  assert.match(source, /<span>추천인/);
  assert.match(source, /<span>가입일/);
  assert.match(source, /item\.user\.phoneNumber/);
  assert.match(source, /item\.referrer\?\.email/);
  assert.match(source, /formatDateTime\(item\.user\.createdAt\)/);
  assert.match(source, /detail\.user\.phoneNumber/);
});

test('admin user panel exposes referral member list without point setting controls', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /referralRewardPercent/);
  assert.doesNotMatch(source, /\/api\/admin\/referral-settings/);
  assert.match(source, /detail\.referrals\.referredUsers/);
  assert.match(source, /pendingPoints/);
  assert.match(source, /confirmedPoints/);
  assert.match(source, /totalPoints/);
  assert.match(source, /추천회원 목록/);
  assert.doesNotMatch(source, /추천포인트 적립률/);
});

test('admin user panel exposes every supported role in the directory filter', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const optionValues = [...source.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);

  assert.equal(optionValues.includes('all'), true);
  assert.equal(optionValues.includes('member'), true);
  assert.equal(optionValues.includes('trial'), true);
  assert.equal(optionValues.includes('subscriber'), true);
  assert.equal(optionValues.includes('salesperson'), true);
  assert.equal(optionValues.includes('admin'), true);
  assert.equal(optionValues.includes('super_admin'), true);
});

test('admin user panel exposes account status filter controls', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /accountStatus/);
  assert.match(source, /aria-label="계정 상태"/);
  assert.match(source, /<option value="active">/);
  assert.match(source, /<option value="suspended">/);
  assert.match(source, /getUserDirectorySummary/);
  assert.match(source, /userDirectorySummary/);
  assert.match(source, /admin-user-summary-strip/);
  assert.match(source, /admin-user-summary-pill/);
  assert.match(cssSource, /\.admin-user-summary-strip/);
  assert.match(cssSource, /\.admin-user-summary-pill/);
});

test('admin user panel labels the latest support thread status in user detail', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatSupportStatusLabel/);
  assert.match(source, /detail\.supportThreads\[0\]\?\.status/);
});

test('admin user panel renders detailed payment support and notification history', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /최근 결제 내역/);
  assert.match(source, /detail\.payments\.map/);
  assert.match(source, /formatPaymentStatusLabel\(payment\.status\)/);
  assert.match(source, /isAdminSubscriptionQueueStatus\(detail\.subscription\.status\)/);
  assert.match(source, /createAdminSubscriptionUrl\(detail\.subscription\.id\)/);
  assert.match(source, /구독 큐에서 보기/);
  assert.match(source, /createAdminPaymentUrl\(payment\.id\)/);
  assert.match(source, /결제 큐에서 보기/);
  assert.match(source, /최근 문의 내역/);
  assert.match(source, /detail\.supportThreads\.map/);
  assert.match(source, /formatSupportStatusLabel\(thread\.status\)/);
  assert.match(source, /createAdminSupportThreadUrl\(thread\.id\)/);
  assert.match(source, /문의 답변 화면/);
  assert.match(source, /최근 알림 내역/);
  assert.match(source, /detail\.notifications\.map/);
  assert.match(source, /getNotificationCategoryLabel\(notification\.category\)/);
  assert.match(source, /getNotificationLinkLabel\(notification\)/);
  assert.match(source, /notification\.readAt \? '읽음' : '미확인'/);
  assert.match(source, /notification\.linkUrl/);
  assert.doesNotMatch(source, /알림 대상 열기/);
});

test('admin user panel renders related audit entries in user detail', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /최근 관리자 조치/);
  assert.match(source, /detail\.auditEntries\.map/);
  assert.match(source, /formatAuditLogSummary/);
  assert.match(source, /entry\.actor\?\.email/);
});

test('admin user panel applies dashboard queue preset events', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /subscribeAdminQueuePresetEvent/);
  assert.match(source, /detail\.panel !== 'users'/);
  assert.match(source, /detail\.presetKey === 'salesperson'/);
  assert.match(source, /getUserDirectoryPresetMessage/);
  assert.match(source, /영업 역할 필터를 적용했습니다\. 영업자 회원만 표시합니다\./);
  assert.match(source, /setRole\(nextRole\)/);
  assert.match(source, /refresh\(\{ role: nextRole, accountStatus: nextAccountStatus, nextMessage \}\)/);
  assert.match(source, /showAllMembersForSalespersonAssignment/);
  assert.match(source, /전체 회원 보기/);
  assert.match(source, /상세를 열어 역할을 영업자로 변경하세요/);
  assert.doesNotMatch(source, /openDetail\(item\.user\.id, 'salesperson'\)/);
  assert.doesNotMatch(source, /item\.user\.role !== 'salesperson' &&/);
  assert.doesNotMatch(source, /영업자로 지정할 준비가 되었습니다/);
  assert.match(source, /showSalespersonHandoff/);
  assert.match(source, /영업관리 회원배정으로 이동/);
  assert.match(source, /salespersonId=\$\{encodeURIComponent\(detail\.user\.id\)\}/);
  assert.match(source, /#admin-sales-assignments/);
  assert.match(cssSource, /\.admin-user-preset-guide/);
  assert.match(cssSource, /\.admin-user-sales-handoff/);
});

test('admin user panel confirms role and account status changes before patching', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useAdminActionConfirmation/);
  assert.match(source, /await confirmAdminAction/);
  assert.match(source, /\{confirmationDialog\}/);
  assert.match(source, /admin\.user\.role\.update/);
  assert.match(source, /admin\.user\.account\.suspend/);
  assert.match(source, /admin\.user\.account\.activate/);
  assert.doesNotMatch(source, /shouldRunAdminAction/);
});

test('admin user panel exposes super-admin-only login email change controls', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /newEmail/);
  assert.match(source, /updateEmail/);
  assert.match(source, /currentAdmin\?\.role === 'super_admin'/);
  assert.match(source, /로그인 이메일 변경/);
  assert.match(source, /슈퍼관리자 전용/);
  assert.match(source, /admin\.user\.email\.update/);
  assert.match(source, /body: JSON\.stringify\(\{ email: newEmail \}\)/);
});

test('admin user directory has polished operator dashboard styling', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-users \.admin-filter-row/);
  assert.match(cssSource, /#admin-users \.table/);
  assert.match(cssSource, /#admin-users \.table tbody tr/);
  assert.match(cssSource, /\.admin-user-summary-strip/);
  assert.match(cssSource, /grid-template-columns: repeat\(5, minmax\(120px, 1fr\)\)/);
  assert.match(cssSource, /\.member-directory-cell span/);
  assert.match(cssSource, /\.admin-detail-panel \.thread-card/);
  assert.match(cssSource, /\.admin-history-card/);
});

test('admin user panel groups directory state into readable table cells', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /className="admin-user-row"/);
  assert.match(source, /member-directory-meta-grid/);
  assert.match(source, /admin-user-role-cell/);
  assert.match(source, /admin-user-account-status/);
  assert.match(source, /admin-user-subscription-cell/);
  assert.match(source, /admin-user-payment-cell/);
  assert.match(source, /admin-user-ops-grid/);
  assert.match(cssSource, /\.member-directory-meta-grid/);
  assert.match(cssSource, /\.admin-user-account-status/);
  assert.match(cssSource, /\.admin-user-ops-grid/);
});

test('admin user directory table keeps stable columns inside a horizontal scroll shell', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const shellRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-users \.admin-user-table-scroll\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body;
  const tableRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-users \.admin-user-table-scroll > \.table\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body;
  const memberCellRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-users \.member-directory-cell\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body;

  assert.match(source, /className="admin-user-table-scroll"/);
  assert.ok(shellRule);
  assert.match(shellRule, /overflow-x:\s*auto;/);
  assert.match(shellRule, /max-width:\s*100%;/);
  assert.ok(tableRule);
  assert.match(tableRule, /min-width:\s*1120px;/);
  assert.match(tableRule, /table-layout:\s*auto;/);
  assert.ok(memberCellRule);
  assert.match(memberCellRule, /display:\s*table-cell;/);
  assert.doesNotMatch(memberCellRule, /display:\s*grid;/);
  assert.match(memberCellRule, /min-width:\s*320px;/);
  assert.match(cssSource, /#admin-users \.member-directory-cell small\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
});

test('admin user directory detail button matches the role badge pill sizing', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const tableButtonIndex = cssSource.indexOf(
    'body:not(:has(.landing-page)) #admin-users .admin-user-table-scroll > .table .button.secondary',
  );
  const detailButtonIndex = cssSource.indexOf(
    'body:not(:has(.landing-page)) #admin-users .admin-user-table-scroll > .table .member-directory-actions .button.secondary',
  );
  const detailButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-users \.admin-user-table-scroll > \.table \.member-directory-actions \.button\.secondary\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body;

  assert.ok(tableButtonIndex >= 0);
  assert.ok(detailButtonIndex > tableButtonIndex);
  assert.ok(detailButtonRule);
  assert.match(detailButtonRule, /min-width:\s*auto;/);
  assert.match(detailButtonRule, /min-height:\s*auto;/);
  assert.match(detailButtonRule, /padding:\s*4px 10px;/);
  assert.match(detailButtonRule, /font-size:\s*12px;/);
  assert.match(detailButtonRule, /line-height:\s*1\.2;/);
});

test('admin user directory contact metadata removes chip outline and fill', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const metaRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-users \.member-directory-meta-grid span\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body;

  assert.ok(metaRule);
  assert.match(metaRule, /border:\s*0;/);
  assert.match(metaRule, /background:\s*transparent;/);
  assert.match(metaRule, /box-shadow:\s*none;/);
});

test('admin user detail panel separates identity controls and history surfaces', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /admin-user-detail-card/);
  assert.match(source, /admin-user-detail-header/);
  assert.match(source, /admin-user-detail-title/);
  assert.match(source, /admin-user-detail-meta/);
  assert.match(source, /admin-user-detail-control-grid/);
  assert.match(source, /admin-user-detail-control-note/);
  assert.match(source, /admin-user-detail-summary-grid/);
  assert.match(source, /admin-user-history-card/);
  assert.match(source, /admin-user-history-list/);
  assert.match(source, /admin-user-history-empty/);
  assert.match(source, /admin-user-audit-history-list/);
});

test('admin user detail panel has dense dark operational styling', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-users \.admin-user-detail-card\s*\{[\s\S]*?display: grid/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-header\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-meta\s*\{[\s\S]*?display: flex/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid\s*\{[\s\S]*?grid-template-columns: minmax\(220px, 1fr\) auto/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-summary-grid\s*\{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(180px, 1fr\)\)/);
  assert.match(cssSource, /#admin-users \.admin-user-history-card\s*\{[\s\S]*?background: rgba\(2, 7, 19, 0\.34\)/);
  assert.match(cssSource, /#admin-users \.admin-user-history-list li\s*\{[\s\S]*?border: 1px solid rgba\(125, 183, 255, 0\.12\)/);
});

test('admin user detail controls do not inherit the light directory filter shell', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid\s*\{[\s\S]*?background: transparent/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid\s*\{[\s\S]*?border: 0/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid\s*\{[\s\S]*?box-shadow: none/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid\s*\{[\s\S]*?padding: 0/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid input:disabled/);
  assert.match(cssSource, /#admin-users \.admin-user-detail-control-grid \.button:disabled\s*\{[\s\S]*?background: rgba\(125, 183, 255, 0\.12\)/);
});

test('admin user audit summaries keep readable text on dark detail cards', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-users \.admin-user-audit-history-list \.audit-summary\s*\{[\s\S]*?color: rgba\(216, 236, 255, 0\.78\)/);
  assert.match(cssSource, /#admin-users \.admin-user-audit-history-list \.audit-summary li\s*\{[\s\S]*?color: rgba\(238, 247, 255, 0\.86\)/);
  assert.match(cssSource, /#admin-users \.admin-user-history-list \.admin-history-row span\s*\{[\s\S]*?color: rgba\(216, 236, 255, 0\.72\)/);
});

test('admin user panel refreshes its filtered directory after local user operations without self-trigger loops', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type UserDirectoryRefreshOptions = UserDirectoryFilterOverride & \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'users'/);
  assert.match(source, /void refresh\(\{ nextMessage: '회원 목록을 갱신했습니다\.' \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'users' \}\)/);
});
