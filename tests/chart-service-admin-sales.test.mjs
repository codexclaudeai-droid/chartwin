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
} from '../src/server/chart-service/index.ts';
import { USER_ROLES } from '../src/domain/chart-service/index.ts';
import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard sections include sales management menu entry', () => {
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.map((section) => section.key), [
    'overview',
    'statistics',
    'sales',
    'users',
    'paymentSettings',
    'payments',
    'subscriptions',
    'support',
    'audit',
  ]);
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales'), 'sales');
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

  assert.equal(summary.defaultTeamPercent, 30);
  assert.equal(summary.teamPageSize, 10);
  assert.equal(summary.selectedTeam?.name, 'Alpha Team');
  assert.equal(summary.selectedTeam?.commissionPercent, 30);
  assert.equal(summary.selectedTeamSalespeople.length, 1);
  assert.deepEqual(summary.teamTotals, {
    salesCount: 1,
    salesUsd: 500,
    points: 150,
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
  assert.match(panelSource, /개별 정산율/);
  assert.match(panelSource, /엑셀출력/);
  assert.match(panelSource, /매출일/);
  assert.match(panelSource, /적립포인트/);
  assert.match(panelSource, /downloadSalesExcel/);
  assert.match(panelSource, /customerQuery/);
  assert.match(panelSource, /selectedCustomerId/);
  assert.match(panelSource, /assignCustomerSalesperson/);
  assert.match(panelSource, /teamName/);
  assert.match(panelSource, /selectedTeamId/);
  assert.match(panelSource, /createSalesTeam/);
  assert.match(panelSource, /assignSalespersonTeam/);
  assert.match(panelSource, /saveTeamCommissionPercent/);
  assert.match(cssSource, /\.sales-filter-grid/);
  assert.match(cssSource, /\.salesperson-list/);
  assert.match(cssSource, /\.sales-customer-list/);
  assert.match(cssSource, /\.sales-team-grid/);
  assert.match(cssSource, /\.sales-team-table/);
});

test('admin sales panel keeps management sections visible before summary data loads', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /EMPTY_SALES_SUMMARY/);
  assert.match(panelSource, /const visibleSummary = summary \?\? EMPTY_SALES_SUMMARY/);
  assert.doesNotMatch(panelSource, /\{summary && \(/);
});
