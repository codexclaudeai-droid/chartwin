import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createMockChartServiceRepository,
  createSessionForUser,
  getAdminSalesManagementSummary,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAdminCustomerSalesperson,
  updateAdminSalesCommissionPercent,
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
  const payload = await patched.json();
  const assignedPayload = await assigned.json();

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(patched.status, 200);
  assert.equal(assigned.status, 200);
  assert.equal(payload.summary.selectedSalesperson.commissionPercent, 32);
  assert.equal(assignedPayload.summary.customers.find((customer) => customer.id === 'user_member').salesperson.id, salesperson.id);
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
  assert.match(cssSource, /\.sales-filter-grid/);
  assert.match(cssSource, /\.salesperson-list/);
  assert.match(cssSource, /\.sales-customer-list/);
});
