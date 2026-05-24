import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getAdminUserDirectory,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAdminUserAccountStatus,
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

test('admin user panel exposes referral member list and super admin reward percent controls', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /referralRewardPercent/);
  assert.match(source, /\/api\/admin\/referral-settings/);
  assert.match(source, /currentAdmin\?\.role === 'super_admin'/);
  assert.match(source, /detail\.referrals\.referredUsers/);
  assert.match(source, /pendingPoints/);
  assert.match(source, /confirmedPoints/);
  assert.match(source, /totalPoints/);
  assert.match(source, /추천회원 목록/);
  assert.match(source, /추천포인트 적립률/);
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

  assert.match(source, /accountStatus/);
  assert.match(source, /aria-label="계정 상태"/);
  assert.match(source, /<option value="active">/);
  assert.match(source, /<option value="suspended">/);
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

  assert.match(source, /subscribeAdminQueuePresetEvent/);
  assert.match(source, /detail\.panel !== 'users'/);
  assert.match(source, /refresh\(\{ accountStatus: nextAccountStatus \}\)/);
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

test('admin user panel refreshes its filtered directory after local user operations without self-trigger loops', () => {
  const source = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type UserDirectoryRefreshOptions = UserDirectoryFilterOverride & \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'users'/);
  assert.match(source, /void refresh\(\{ nextMessage: '회원 목록을 갱신했습니다\.' \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'users' \}\)/);
});
