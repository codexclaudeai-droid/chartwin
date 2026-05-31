import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createMockChartServiceRepository,
  createSessionForUser,
  createAdminSalesTeam,
  assignAdminSalespersonToTeam,
  getAdminSalesManagementSummary,
  getChartServiceRepository,
  createMockChartServiceState,
  SESSION_COOKIE_NAME,
  updateAdminCustomerSalesperson,
  updateAdminSalesCommissionPercent,
  updateAdminSalesTeamCommissionPercent,
  updatePointProgramSettings,
} from '../src/server/chart-service/index.ts';
import { USER_ROLES } from '../src/domain/chart-service/index.ts';
import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard sections include sales management menu entry', () => {
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.map((section) => section.key), [
    'overview',
    'webInfo',
    'symbols',
    'users',
    'support',
    'payments',
    'subscriptions',
    'sales',
    'statistics',
    'audit',
  ]);
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales'), 'sales');
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.find((section) => section.key === 'sales')?.children, [
    { label: '영업팀', href: '#admin-sales-teams' },
    { label: '영업자', href: '#admin-sales-people' },
    { label: '회원배정', href: '#admin-sales-assignments' },
    { label: '매출현황', href: '#admin-sales-revenue' },
  ]);
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-teams'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-people'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-assignments'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-revenue'), 'sales');
});

test('admin sales management summary lists salesperson revenue rows and totals', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  const customer = repository.getUserById('user_member');
  if (!salesperson || !customer) throw new Error('fixture users missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });
  repository.saveUser({ ...customer, referredByUserId: salesperson.id });
  repository.savePayment({
    ...repository.getPaymentById('pay_pending'),
    id: 'pay_sales_1',
    userId: customer.id,
    subscriptionId: 'sub_pending',
    status: 'confirmed',
    amountUsd: 300,
    confirmedAt: '2026-05-24T03:00:00.000Z',
    updatedAt: '2026-05-24T03:00:00.000Z',
  });

  const summary = getAdminSalesManagementSummary(repository, {
    salespersonId: salesperson.id,
    from: '2026-05-01',
    to: '2026-05-31',
  });

  assert.equal(summary.defaultPercent, 30);
  assert.equal(summary.selectedSalesperson?.email, 'subscriber@example.com');
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].salesDate, '2026-05-24');
  assert.equal(summary.rows[0].email, 'member@example.com');
  assert.equal(summary.rows[0].subscriptionPlan, 'Monthly');
  assert.equal(summary.rows[0].commissionPercent, 30);
  assert.equal(summary.rows[0].points, 90);
  assert.deepEqual(summary.totals, {
    salesCount: 1,
    salesUsd: 300,
    points: 90,
  });
});

test('admin sales management summary uses point settings as the default salesperson percent', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  const customer = repository.getUserById('user_member');
  if (!salesperson || !customer) throw new Error('fixture users missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });
  repository.saveUser({ ...customer, referredByUserId: salesperson.id });
  repository.savePayment({
    ...repository.getPaymentById('pay_pending'),
    id: 'pay_sales_point_settings',
    userId: customer.id,
    subscriptionId: 'sub_pending',
    status: 'confirmed',
    amountUsd: 300,
    confirmedAt: '2026-05-24T03:00:00.000Z',
    updatedAt: '2026-05-24T03:00:00.000Z',
  });

  updatePointProgramSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    subscriberCashbackPercent: 3,
    rewardPercent: 10,
    salespersonRewardPercent: 25,
    salesTeamRewardPercent: 55,
    updatedAt: '2026-05-25T09:00:00.000Z',
  });
  const summary = getAdminSalesManagementSummary(repository, { salespersonId: salesperson.id });

  assert.equal(summary.defaultPercent, 25);
  assert.equal(summary.selectedSalesperson?.commissionPercent, 25);
  assert.equal(summary.rows[0].commissionPercent, 25);
});

test('admin sales management summary uses point settings as the default sales team percent', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  if (!salesperson) throw new Error('fixture salesperson missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });

  updatePointProgramSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    subscriberCashbackPercent: 3,
    rewardPercent: 10,
    salespersonRewardPercent: 25,
    salesTeamRewardPercent: 55,
    updatedAt: '2026-05-25T09:00:00.000Z',
  });
  const team = createAdminSalesTeam(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    name: 'Point Settings Team',
    createdAt: '2026-05-25T10:00:00.000Z',
  });
  const summary = getAdminSalesManagementSummary(repository, { teamId: team.id });

  assert.equal(summary.defaultTeamPercent, 55);
  assert.equal(summary.selectedTeam?.commissionPercent, 55);
});

test('super admin can apply individual salesperson commission percent', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  if (!salesperson) throw new Error('fixture salesperson missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });

  const settings = updateAdminSalesCommissionPercent(repository, {
    admin: { id: 'super_1', role: USER_ROLES.superAdmin },
    salespersonId: salesperson.id,
    commissionPercent: 35,
    updatedAt: '2026-05-25T00:00:00.000Z',
  });
  const summary = getAdminSalesManagementSummary(repository, { salespersonId: salesperson.id });

  assert.equal(settings.defaultPercent, 30);
  assert.equal(summary.selectedSalesperson?.commissionPercent, 35);
});

test('admin can assign a customer to a salesperson and sales summary follows the assignment', () => {
  const repository = createMockChartServiceRepository();
  const oldSalesperson = repository.getUserById('user_subscriber');
  const newSalesperson = repository.getUserById('user_trial');
  const customer = repository.getUserById('user_member');
  const payment = repository.getPaymentById('pay_pending');
  if (!oldSalesperson || !newSalesperson || !customer || !payment) throw new Error('fixture records missing');
  repository.saveUser({ ...oldSalesperson, role: USER_ROLES.salesperson });
  repository.saveUser({ ...newSalesperson, role: USER_ROLES.salesperson });
  repository.savePayment({
    ...payment,
    status: 'confirmed',
    confirmedAt: '2026-05-24T03:00:00.000Z',
    updatedAt: '2026-05-24T03:00:00.000Z',
  });

  const detail = updateAdminCustomerSalesperson(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    customerId: customer.id,
    salespersonId: newSalesperson.id,
  });
  const oldSummary = getAdminSalesManagementSummary(repository, { salespersonId: oldSalesperson.id });
  const newSummary = getAdminSalesManagementSummary(repository, { salespersonId: newSalesperson.id });

  assert.equal(detail.customer.referredByUserId, newSalesperson.id);
  assert.equal(detail.salesperson?.email, 'trial@example.com');
  assert.equal(repository.getUserById(customer.id)?.referredByUserId, newSalesperson.id);
  assert.equal(oldSummary.rows.length, 0);
  assert.equal(newSummary.rows.length, 1);
  assert.equal(newSummary.rows[0].email, 'member@example.com');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.sales.customer.assign');
});

test('admin sales management summary exposes customer assignment candidates', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  if (!salesperson) throw new Error('fixture salesperson missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });

  const summary = getAdminSalesManagementSummary(repository, {
    salespersonId: salesperson.id,
    customerQuery: 'member',
  });

  assert.equal(summary.customerQuery, 'member');
  assert.equal(summary.customers.length, 1);
  assert.equal(summary.customers[0].email, 'member@example.com');
  assert.equal(summary.customers[0].salesperson?.email, 'subscriber@example.com');
});

test('admin can register sales teams assign salespeople and aggregate team revenue', () => {
  const repository = createMockChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  const customer = repository.getUserById('user_member');
  const payment = repository.getPaymentById('pay_pending');
  if (!salesperson || !customer || !payment) throw new Error('fixture records missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });
  repository.saveUser({ ...customer, referredByUserId: salesperson.id });
  repository.savePayment({
    ...payment,
    status: 'confirmed',
    amountUsd: 500,
    confirmedAt: '2026-05-24T03:00:00.000Z',
    updatedAt: '2026-05-24T03:00:00.000Z',
  });

  const team = createAdminSalesTeam(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    name: 'Alpha Team',
    createdAt: '2026-05-25T00:00:00.000Z',
  });
  assignAdminSalespersonToTeam(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    salespersonId: salesperson.id,
    teamId: team.id,
    updatedAt: '2026-05-25T00:01:00.000Z',
  });

  const summary = getAdminSalesManagementSummary(repository, {
    teamId: team.id,
    from: '2026-05-01',
    to: '2026-05-31',
  });

  assert.equal(summary.defaultTeamPercent, 50);
  assert.equal(summary.teamPageSize, 10);
  assert.equal(summary.selectedTeam?.name, 'Alpha Team');
  assert.equal(summary.selectedTeam?.commissionPercent, 50);
  assert.equal(summary.selectedTeamSalespeople.length, 1);
  assert.deepEqual(summary.teamTotals, {
    salesCount: 1,
    salesUsd: 500,
    points: 250,
  });
  assert.equal(summary.selectedTeamSalespeople[0].sequence, 1);
  assert.equal(summary.selectedTeamSalespeople[0].name, 'Subscriber');
  assert.equal(summary.selectedTeamSalespeople[0].phoneNumber, null);
});

test('sales team records persist through the repository instead of process memory only', () => {
  const state = createMockChartServiceState();
  const firstRepository = createMockChartServiceRepository(state);
  const team = createAdminSalesTeam(firstRepository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    name: 'Persisted Team',
    createdAt: '2026-05-25T00:00:00.000Z',
  });

  const secondRepository = createMockChartServiceRepository(state);
  const summary = getAdminSalesManagementSummary(secondRepository, { teamId: team.id });

  assert.equal(secondRepository.listSalesTeams().length, 1);
  assert.equal(summary.selectedTeam?.name, 'Persisted Team');
});

test('super admin can apply team commission percent and normal admin cannot', () => {
  const repository = createMockChartServiceRepository();
  const team = createAdminSalesTeam(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    name: 'Beta Team',
    createdAt: '2026-05-25T00:00:00.000Z',
  });

  assert.throws(() => updateAdminSalesTeamCommissionPercent(repository, {
    admin: { id: 'admin_1', role: USER_ROLES.admin },
    teamId: team.id,
    commissionPercent: 40,
    updatedAt: '2026-05-25T00:02:00.000Z',
  }), /Super admin/);

  updateAdminSalesTeamCommissionPercent(repository, {
    admin: { id: 'super_1', role: USER_ROLES.superAdmin },
    teamId: team.id,
    commissionPercent: 40,
    updatedAt: '2026-05-25T00:03:00.000Z',
  });

  const summary = getAdminSalesManagementSummary(repository, { teamId: team.id });
  assert.equal(summary.selectedTeam?.commissionPercent, 40);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.sales.team.commission_percent.update');
});

test('admin sales API requires admin session and lets super admin update commission percent', async () => {
  const repository = getChartServiceRepository();
  const salesperson = repository.getUserById('user_subscriber');
  if (!salesperson) throw new Error('fixture salesperson missing');
  repository.saveUser({ ...salesperson, role: USER_ROLES.salesperson });
  const { session } = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { GET, PATCH } = await import('../app/api/admin/sales/route.ts');

  const denied = await GET(new Request('http://localhost/api/admin/sales'));
  const allowed = await GET(new Request('http://localhost/api/admin/sales', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
  }));
  const patched = await PATCH(new Request('http://localhost/api/admin/sales', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ salespersonId: salesperson.id, commissionPercent: 32 }),
  }));
  const assigned = await PATCH(new Request('http://localhost/api/admin/sales', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'assignCustomerSalesperson',
      customerId: 'user_member',
      salespersonId: salesperson.id,
    }),
  }));
  const createdTeam = await PATCH(new Request('http://localhost/api/admin/sales', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'createSalesTeam',
      teamName: 'API Team',
    }),
  }));
  const teamPayload = await createdTeam.json();
  const assignedTeam = await PATCH(new Request('http://localhost/api/admin/sales', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'assignSalespersonTeam',
      salespersonId: salesperson.id,
      teamId: teamPayload.summary.selectedTeam.id,
    }),
  }));
  const patchedTeam = await PATCH(new Request('http://localhost/api/admin/sales', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'updateSalesTeamCommission',
      teamId: teamPayload.summary.selectedTeam.id,
      commissionPercent: 36,
    }),
  }));
  const payload = await patched.json();
  const assignedPayload = await assigned.json();
  const assignedTeamPayload = await assignedTeam.json();
  const patchedTeamPayload = await patchedTeam.json();

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(patched.status, 200);
  assert.equal(assigned.status, 200);
  assert.equal(createdTeam.status, 200);
  assert.equal(assignedTeam.status, 200);
  assert.equal(patchedTeam.status, 200);
  assert.equal(payload.summary.selectedSalesperson.commissionPercent, 32);
  assert.equal(assignedPayload.summary.customers.find((customer) => customer.id === 'user_member').salesperson.id, salesperson.id);
  assert.equal(assignedTeamPayload.summary.selectedTeamSalespeople[0].id, salesperson.id);
  assert.equal(patchedTeamPayload.summary.selectedTeam.commissionPercent, 36);
});

test('admin sales panel renders filters commission editing table totals and excel export', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminSalesPanel/);
  assert.match(pageSource, /AdminDashboardShellSection sectionKey="sales"/);
  assert.match(panelSource, /\/api\/admin\/sales/);
  assert.match(panelSource, /영업관리/);
  assert.match(panelSource, /영업자 검색/);
  assert.match(panelSource, /기간 범위/);
  assert.match(panelSource, /sales-date-range-field/);
  assert.doesNotMatch(panelSource, /calendar-icon/);
  assert.equal((panelSource.match(/type="date"/g) ?? []).length, 2);
  assert.doesNotMatch(panelSource, /<label>\s*<span className="calendar-icon"/);
  assert.match(panelSource, /sales-date-range-separator/);
  assert.match(panelSource, /aria-label="기간 범위 시작"/);
  assert.match(panelSource, /aria-label="기간 범위 종료"/);
  assert.match(panelSource, /개별 정산율/);
  assert.match(panelSource, /엑셀출력/);
  assert.match(panelSource, /매출일/);
  assert.match(panelSource, /적립포인트/);
  assert.match(panelSource, /downloadSalesExcel/);
  assert.match(panelSource, /SALES_SUBMENU/);
  assert.match(panelSource, /admin-sales-teams/);
  assert.match(panelSource, /admin-sales-people/);
  assert.match(panelSource, /admin-sales-assignments/);
  assert.match(panelSource, /admin-sales-revenue/);
  assert.match(panelSource, /getSalesPageFromHash/);
  assert.match(panelSource, /getSalespersonIdFromSearch/);
  assert.match(panelSource, /window\.location\.search/);
  assert.match(panelSource, /회원관리에서 지정한 영업자를 선택했습니다\. 회원 배정을 이어가세요\./);
  assert.match(panelSource, /setQuery\(`\$\{payload\.summary\.selectedSalesperson\.name\} \$\{payload\.summary\.selectedSalesperson\.email\}`\)/);
  assert.match(panelSource, /customerSearchInputRef/);
  assert.match(panelSource, /customerSearchInputRef\.current\?\.focus\(\)/);
  assert.match(panelSource, /ref=\{customerSearchInputRef\}/);
  assert.match(panelSource, /hashchange/);
  assert.match(panelSource, /activePage === 'teams'/);
  assert.match(panelSource, /activePage === 'people'/);
  assert.match(panelSource, /activePage === 'assignments'/);
  assert.match(panelSource, /activePage === 'revenue'/);
  assert.match(panelSource, /검색\/선택 영업자/);
  assert.match(panelSource, /배정 대상 회원/);
  assert.match(panelSource, /visibleSummary\.selectedSalesperson\?\.name/);
  assert.match(panelSource, /visibleSummary\.selectedSalesperson\.email/);
  assert.match(panelSource, /isSalespersonSearchOpen/);
  assert.match(panelSource, /getSalespersonSearchResults/);
  assert.match(panelSource, /salespersonSearchResults/);
  assert.match(panelSource, /shouldShowSalespersonSearchPanel/);
  assert.match(panelSource, /salesperson-search-results/);
  assert.match(panelSource, /salesperson-search-empty/);
  assert.match(panelSource, /검색 결과 없음/);
  assert.match(panelSource, /회원관리로 이동/);
  assert.match(panelSource, /href="#admin-users"/);
  assert.match(panelSource, /dispatchAdminQueuePresetEvent/);
  assert.match(panelSource, /function applySalespersonUserFilter/);
  assert.match(panelSource, /onClick=\{applySalespersonUserFilter\}/);
  assert.match(panelSource, /presetKey: 'salesperson'/);
  assert.match(panelSource, /회원관리에서 영업자 지정/);
  assert.match(panelSource, /selectSalespersonFromSearch/);
  assert.match(panelSource, /highlightedSalespersonIndex/);
  assert.match(panelSource, /handleSalespersonSearchKeyDown/);
  assert.match(panelSource, /ArrowDown/);
  assert.match(panelSource, /ArrowUp/);
  assert.match(panelSource, /Escape/);
  assert.match(panelSource, /event\.key === 'Enter'/);
  assert.match(panelSource, /aria-autocomplete="list"/);
  assert.match(panelSource, /aria-activedescendant/);
  assert.match(panelSource, /role="listbox"/);
  assert.match(panelSource, /role="option"/);
  assert.match(panelSource, /customerQuery/);
  assert.match(panelSource, /selectedCustomerId/);
  assert.match(panelSource, /assignCustomerSalesperson/);
  assert.match(panelSource, /teamName/);
  assert.match(panelSource, /selectedTeamId/);
  assert.match(panelSource, /createSalesTeam/);
  assert.match(panelSource, /assignSalespersonTeam/);
  assert.match(panelSource, /saveTeamCommissionPercent/);
  assert.match(cssSource, /\.sales-filter-grid/);
  assert.match(cssSource, /\.sales-date-range-field/);
  assert.match(cssSource, /\.sales-date-range-separator/);
  assert.match(cssSource, /\.salesperson-list/);
  assert.match(cssSource, /\.sales-customer-list/);
  assert.match(cssSource, /\.sales-team-grid/);
  assert.match(cssSource, /\.sales-team-table/);
  assert.match(cssSource, /\.sales-submenu-tabs/);
  assert.match(cssSource, /\.salesperson-search-field/);
  assert.match(cssSource, /\.salesperson-search-results/);
  assert.match(cssSource, /\.salesperson-search-results button\.highlighted/);
  assert.match(cssSource, /\.salesperson-search-empty/);
});

test('admin sales salesperson search dropdown keeps text readable in dark theme', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) #admin-sales \.salesperson-search-results button span/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) #admin-sales \.salesperson-search-results button small/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) #admin-sales \.salesperson-search-empty strong\s*\{[\s\S]*?color: #ffffff/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) #admin-sales \.salesperson-search-empty p\s*\{[\s\S]*?color: rgba\(216, 236, 255, 0\.72\)/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) #admin-sales \.salesperson-search-empty a\s*\{[\s\S]*?color: #ffffff/);
});

test('admin sales date range inputs remove the dark focus outline', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const dateInputRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-sales \.sales-date-range-field input\[type="date"\]\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const focusWithinRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-sales \.sales-date-range-field:focus-within\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const dateInputFocusRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-sales \.sales-date-range-field input\[type="date"\]:focus,\s*body:not\(:has\(\.landing-page\)\) #admin-sales \.sales-date-range-field input\[type="date"\]:focus-visible\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(dateInputRule, /border:\s*0/);
  assert.match(dateInputRule, /box-shadow:\s*none/);
  assert.match(dateInputRule, /outline:\s*0/);
  assert.match(focusWithinRule, /border-color:\s*transparent/);
  assert.match(focusWithinRule, /box-shadow:\s*none/);
  assert.match(dateInputFocusRule, /border-color:\s*transparent/);
  assert.match(dateInputFocusRule, /box-shadow:\s*none/);
  assert.match(dateInputFocusRule, /outline:\s*0/);
});

test('admin sales panel keeps management sections visible before summary data loads', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /EMPTY_SALES_SUMMARY/);
  assert.match(panelSource, /const visibleSummary = summary \?\? EMPTY_SALES_SUMMARY/);
  assert.doesNotMatch(panelSource, /\{summary && \(/);
});

test('admin sales panel has polished operator dashboard styling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-sales \.sales-filter-grid/);
  assert.match(cssSource, /#admin-sales \.sales-summary-grid \.mini-card/);
  assert.match(cssSource, /#admin-sales \.salesperson-card/);
  assert.match(cssSource, /#admin-sales \.sales-team-card/);
  assert.match(cssSource, /#admin-sales \.sales-customer-card/);
  assert.match(cssSource, /#admin-sales \.sales-assignment-panel/);
  assert.match(cssSource, /#admin-sales \.sales-team-panel/);
  assert.match(cssSource, /#admin-sales \.table/);
  assert.match(cssSource, /#admin-sales \.table tfoot/);
});

test('admin sales submenu tabs center labels inside rounded pills', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-sales \.sales-submenu-tabs a\s*\{[^}]*display: inline-flex/);
  assert.match(cssSource, /#admin-sales \.sales-submenu-tabs a\s*\{[^}]*align-items: center/);
  assert.match(cssSource, /#admin-sales \.sales-submenu-tabs a\s*\{[^}]*justify-content: center/);
  assert.match(cssSource, /#admin-sales \.sales-submenu-tabs a\s*\{[^}]*line-height: 1/);
});

test('admin sales team page groups team cards and member table for readability', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /sales-team-dashboard/);
  assert.match(panelSource, /sales-team-control-bar/);
  assert.match(panelSource, /sales-team-card-kicker/);
  assert.match(panelSource, /sales-team-card-title/);
  assert.match(panelSource, /sales-team-card-metrics/);
  assert.match(panelSource, /sales-team-member-table/);
  assert.match(panelSource, /sales-team-member-cell/);
  assert.match(panelSource, /sales-team-money-cell/);
  assert.match(panelSource, /sales-team-empty-row/);
});

test('admin sales team page uses dense dark operational styling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /#admin-sales \.sales-team-dashboard\s*\{[\s\S]*?display: grid/);
  assert.match(cssSource, /#admin-sales \.sales-team-control-bar\s*\{[\s\S]*?grid-template-columns: minmax\(240px, 1fr\) auto/);
  assert.match(cssSource, /#admin-sales \.sales-team-grid\s*\{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
  assert.match(cssSource, /#admin-sales \.sales-team-card-metrics\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /#admin-sales \.sales-team-member-table\s*\{[\s\S]*?table-layout: fixed/);
  assert.match(cssSource, /#admin-sales \.sales-team-member-cell strong\s*\{[\s\S]*?color: #ffffff/);
});
