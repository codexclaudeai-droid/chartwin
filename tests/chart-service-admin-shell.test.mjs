import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard sections define the professional sidebar order', () => {
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
  assert.equal(ADMIN_DASHBOARD_SECTIONS[0].href, '#admin-overview');
  assert.equal(ADMIN_DASHBOARD_SECTIONS.at(-1).href, '#admin-audit-logs');
  assert.equal(ADMIN_DASHBOARD_SECTIONS.some((section) => section.key === 'paymentSettings'), false);
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.find((section) => section.key === 'webInfo')?.children, [
    { label: '가입약관', href: '#admin-web-info-terms' },
    { label: '개인정보보호정책', href: '#admin-web-info-privacy' },
    { label: '플랜 제공서비스', href: '#admin-plan-services' },
    { label: '공개게시판', href: '#admin-public-board' },
    { label: '입금정보관리', href: '#admin-payment-settings' },
    { label: '포인트관리', href: '#admin-point-settings' },
  ]);
  assert.deepEqual(ADMIN_DASHBOARD_SECTIONS.find((section) => section.key === 'sales')?.children, [
    { label: '영업팀', href: '#admin-sales-teams' },
    { label: '영업자', href: '#admin-sales-people' },
    { label: '회원배정', href: '#admin-sales-assignments' },
    { label: '매출현황', href: '#admin-sales-revenue' },
  ]);
});

test('admin dashboard shell maps legacy anchors and deep links to sidebar sections', () => {
  assert.equal(getAdminDashboardSectionFromLocation(''), 'overview');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-overview'), 'overview');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info-terms'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info-privacy'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-plan-services'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-symbols'), 'symbols');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics'), 'statistics');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-teams'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-people'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-assignments'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales-revenue'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-users'), 'users');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-payment-settings'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-point-settings'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-payments'), 'payments');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-payment-pay_pending'), 'payments');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-subscriptions'), 'subscriptions');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-subscription-sub_pending'), 'subscriptions');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-support'), 'support');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-support-reply-support_123'), 'support');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-audit-logs'), 'audit');
  assert.equal(getAdminDashboardSectionFromLocation('', '?supportThread=support_123'), 'support');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-audit-logs', '?supportThread=support_123'), 'audit');
});

test('admin page wraps operation panels in the dashboard shell sections', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const shellSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-shell.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminDashboardShell/);
  assert.match(pageSource, /sectionKey="overview"[\s\S]*sectionKey="webInfo"[\s\S]*sectionKey="symbols"[\s\S]*sectionKey="users"[\s\S]*sectionKey="support"[\s\S]*sectionKey="payments"[\s\S]*sectionKey="subscriptions"[\s\S]*sectionKey="sales"[\s\S]*sectionKey="statistics"[\s\S]*sectionKey="audit"/);
  assert.doesNotMatch(pageSource, /AdminDashboardShellSection sectionKey="paymentSettings"/);
  assert.match(pageSource, /sectionKey="webInfo"[\s\S]*AdminWebInfoSection/);
  assert.doesNotMatch(pageSource, /sectionKey="webInfo"[\s\S]*AdminWebInfoPanel[\s\S]*AdminPaymentSettingsPanel/);
  assert.match(shellSource, /admin-dashboard-sidebar/);
  assert.doesNotMatch(shellSource, /admin-dashboard-workspace-header/);
  assert.doesNotMatch(shellSource, /activeSectionMeta/);
  assert.doesNotMatch(cssSource, /admin-dashboard-workspace-header/);
  assert.match(shellSource, /data-active-admin-section=\{activeSection\}/);
  assert.match(shellSource, /activeTargetId/);
  assert.match(shellSource, /getInitialAdminDashboardState/);
  assert.doesNotMatch(shellSource, /useState<AdminDashboardSectionKey>\('overview'\)/);
  assert.match(shellSource, /useState<AdminDashboardSectionKey>\(\(\) => getInitialAdminDashboardState\(\)\.activeSection\)/);
  assert.match(shellSource, /\}, \[activeTargetId\]\)/);
  assert.match(shellSource, /getActiveChildHref/);
  assert.match(shellSource, /aria-current=\{isChildActive \? 'page' : undefined\}/);
  assert.match(shellSource, /className=\{isChildActive \? 'active' : ''\}/);
  assert.match(shellSource, /section\.href === `#\$\{activeTargetId\}`/);
  assert.match(shellSource, /section\.children\[0\]\?\.href/);
  assert.match(shellSource, /scrollIntoView\(\{ block: 'start'/);
  assert.match(cssSource, /\.admin-dashboard-shell/);
  assert.match(cssSource, /\.admin-dashboard-sidebar/);
  assert.match(cssSource, /\.admin-dashboard-section\[hidden\]/);
});

test('admin sidebar submenus roll out on hover and keyboard focus', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /\.admin-dashboard-menu-group:has\(\.admin-dashboard-submenu\)/);
  assert.match(cssSource, /\.admin-dashboard-submenu/);
  assert.match(cssSource, /max-height: 0/);
  assert.match(cssSource, /overflow: hidden/);
  assert.match(cssSource, /pointer-events: none/);
  assert.match(cssSource, /transition: max-height/);
  assert.match(cssSource, /\.admin-dashboard-menu-group:hover \.admin-dashboard-submenu/);
  assert.match(cssSource, /\.admin-dashboard-menu-group:focus-within \.admin-dashboard-submenu/);
  assert.match(cssSource, /\.admin-dashboard-menu-group:has\(\.admin-dashboard-menu-item\.active\) \.admin-dashboard-submenu/);
  assert.match(cssSource, /pointer-events: auto/);
  assert.match(cssSource, /\.admin-dashboard-submenu a\.active/);
  assert.match(cssSource, /\.admin-dashboard-submenu a\[aria-current="page"\]/);
});

test('admin sidebar menu wraps on small screens instead of horizontal scrolling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const mobileMenuRule = cssSource.match(
    /@media \(max-width: 960px\)[\s\S]*?\.admin-dashboard-menu\s*\{(?<rule>[^}]+)\}/,
  );

  assert.ok(mobileMenuRule?.groups?.rule);
  assert.match(mobileMenuRule.groups.rule, /display: grid/);
  assert.match(mobileMenuRule.groups.rule, /grid-template-columns: repeat\(auto-fit, minmax\(150px, 1fr\)\)/);
  assert.match(mobileMenuRule.groups.rule, /overflow: visible/);
  assert.doesNotMatch(mobileMenuRule.groups.rule, /overflow-x: auto/);
});

test('admin dashboard uses polished console design tokens and surfaces', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(cssSource, /--admin-surface:/);
  assert.match(cssSource, /--admin-sidebar:/);
  assert.match(cssSource, /--admin-glow:/);
  assert.match(cssSource, /\.admin-dashboard-sidebar::before/);
  assert.match(cssSource, /\.admin-dashboard-workspace/);
  assert.match(cssSource, /animation: admin-section-rise/);
  assert.match(cssSource, /@keyframes admin-section-rise/);
  assert.match(cssSource, /\.admin-page \.card/);
  assert.match(cssSource, /\.admin-page \.table/);
  assert.match(cssSource, /\.admin-page \.form input:focus/);
  assert.match(cssSource, /\.admin-page \.button:hover:not\(:disabled\)/);
});
