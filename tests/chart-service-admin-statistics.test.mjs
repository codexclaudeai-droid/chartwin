import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createMockChartServiceRepository,
  createSessionForUser,
  getAdminStatisticsSummary,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';
import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard sections include a statistics menu entry', () => {
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.map((section) => section.key), [
    'overview',
    'webInfo',
    'symbols',
    'telegramAlerts',
    'users',
    'support',
    'payments',
    'subscriptions',
    'sales',
    'statistics',
    'audit',
  ]);
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics'), 'statistics');
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.find((section) => section.key === 'statistics')?.children, [
    { label: '매출통계', href: '#admin-statistics-sales' },
    { label: '가입자통계', href: '#admin-statistics-signups' },
    { label: '방문자통계', href: '#admin-statistics-visitors' },
  ]);
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics-sales'), 'statistics');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics-signups'), 'statistics');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics-visitors'), 'statistics');
});

test('admin statistics summary groups sales signups and visitors by day month and year', () => {
  const repository = createMockChartServiceRepository();
  const summary = getAdminStatisticsSummary(repository);

  assert.deepEqual(Object.keys(summary), ['daily', 'monthly', 'yearly']);
  assert.equal(summary.daily.sales.series.some((point) => point.barValue > 0), true);
  assert.equal(summary.monthly.signups.series.some((point) => point.barValue > 0), true);
  assert.equal(summary.yearly.visitors.series.some((point) => point.barValue > 0), true);
  assert.equal(summary.daily.sales.yAxisTicks.length, 5);
  assert.equal(summary.daily.sales.tableRows[0].label, '2026-05-23');
  assert.equal(summary.daily.sales.tableRows[0].salesUsd, 199);
});

test('admin statistics summary tolerates legacy records without date fields', () => {
  const repository = createMockChartServiceRepository();
  const legacyUser = repository.getUserById('user_member');
  if (!legacyUser) throw new Error('fixture user missing');
  const { createdAt: _createdAt, ...legacyUserWithoutDate } = legacyUser;
  repository.saveUser(legacyUserWithoutDate);

  const summary = getAdminStatisticsSummary(repository);

  assert.equal(summary.daily.sales.tableRows.some((row) => row.label === '2026-05-23'), true);
  assert.equal(summary.daily.signups.series.some((point) => point.barValue > 0), true);
});

test('admin statistics API requires admin session and returns chart datasets', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { GET } = await import('../app/api/admin/statistics/route.ts');

  const denied = await GET(new Request('http://localhost/api/admin/statistics'));
  const allowed = await GET(new Request('http://localhost/api/admin/statistics', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
  }));
  const payload = await allowed.json();

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(Array.isArray(payload.statistics.daily.sales.series), true);
  assert.equal(typeof payload.statistics.monthly.visitors.yAxisTicks[0], 'number');
});

test('admin statistics panel renders sidebar-linked sub pages period controls mixed chart and y axis labels', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-statistics-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminStatisticsPanel/);
  assert.match(pageSource, /AdminDashboardShellSection sectionKey="statistics"/);
  assert.match(panelSource, /\/api\/admin\/statistics/);
  assert.match(panelSource, /admin-statistics-sales/);
  assert.match(panelSource, /admin-statistics-signups/);
  assert.match(panelSource, /admin-statistics-visitors/);
  assert.match(panelSource, /getMetricFromHash/);
  assert.match(panelSource, /hashchange/);
  assert.match(panelSource, /매출통계/);
  assert.match(panelSource, /가입자통계/);
  assert.match(panelSource, /방문자통계/);
  assert.match(panelSource, /일별/);
  assert.match(panelSource, /월별/);
  assert.match(panelSource, /년도별/);
  assert.match(panelSource, /statistics-y-axis/);
  assert.match(panelSource, /statistics-bar/);
  assert.match(panelSource, /statistics-line/);
  assert.match(panelSource, /activeMetricMeta\.anchorId/);
  assert.doesNotMatch(panelSource, /aria-label="통계 종류"[\s\S]*button/);
  assert.match(panelSource, /\(index \+ 0\.5\) \/ length/);
  assert.match(panelSource, /r="2"/);
  assert.match(cssSource, /\.statistics-chart/);
  assert.match(cssSource, /\.statistics-y-axis/);
  assert.match(cssSource, /\.statistics-bar/);
  assert.match(cssSource, /height: calc\(100% - 36px\)/);
  assert.match(cssSource, /width: calc\(100% - 28px\)/);
  assert.match(cssSource, /stroke-width: 2\.1/);
  assert.match(cssSource, /stroke-width: 1\.5/);
});

test('admin statistics submenu uses dark admin tab styling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const submenuRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-statistics \.statistics-submenu-tabs\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const linkRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-statistics \.statistics-submenu-tabs a\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const activeRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-statistics \.statistics-submenu-tabs a:hover,[\s\S]*?body:not\(:has\(\.landing-page\)\) #admin-statistics \.statistics-submenu-tabs a\[aria-current="page"\]\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(submenuRule, /background:\s*rgba\(2, 7, 19, 0\.62\)/);
  assert.match(submenuRule, /border:\s*0/);
  assert.match(submenuRule, /box-shadow:\s*none/);
  assert.match(linkRule, /display:\s*inline-flex/);
  assert.match(linkRule, /align-items:\s*center/);
  assert.match(linkRule, /justify-content:\s*center/);
  assert.match(linkRule, /color:\s*rgba\(216, 236, 255, 0\.78\)/);
  assert.match(activeRule, /background:\s*linear-gradient\(135deg, rgba\(55, 125, 255, 0\.96\), rgba\(98, 166, 255, 0\.86\)\)/);
  assert.match(activeRule, /color:\s*#ffffff/);
  assert.match(activeRule, /box-shadow:\s*none/);
});
