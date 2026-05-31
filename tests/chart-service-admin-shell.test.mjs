import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';
import {
  formatAdminDisplayId,
  getAdminDisplaySequence,
} from '../app/admin/admin-display-id.ts';

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
    { label: '공지팝업', href: '#admin-notice-popup' },
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
  assert.equal(getAdminDashboardSectionFromLocation('#admin-notice-popup'), 'webInfo');
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
  assert.match(
    cssSource,
    /body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > \.card,\s*body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > div > \.card\s*\{[\s\S]*?padding:\s*0\s*!important[\s\S]*?border:\s*0\s*!important[\s\S]*?background:\s*transparent\s*!important[\s\S]*?box-shadow:\s*none\s*!important/,
  );
  assert.match(
    cssSource,
    /body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > \.card > \.toolbar,\s*body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > div > \.card > \.toolbar\s*\{[\s\S]*?padding-top:\s*4px/,
  );
  assert.match(
    cssSource,
    /body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > \.card > \.toolbar h2,\s*body:not\(:has\(\.landing-page\)\) \.admin-page \.admin-dashboard-section > div > \.card > \.toolbar h2\s*\{[\s\S]*?line-height:\s*1\.28[\s\S]*?overflow:\s*visible/,
  );
  assert.match(cssSource, /\.admin-page \.table/);
  assert.match(cssSource, /\.admin-page \.form input:focus/);
  assert.match(cssSource, /\.admin-page \.button:hover:not\(:disabled\)/);
});

test('admin refresh controls use the shared icon button', () => {
  const buttonSource = fs.readFileSync(new URL('../app/admin/admin-refresh-button.tsx', import.meta.url), 'utf8');
  const sharedButtonSource = fs.readFileSync(new URL('../app/shared/refresh-icon-button.tsx', import.meta.url), 'utf8');
  const dashboardSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-panel.tsx', import.meta.url), 'utf8');
  const symbolsSource = fs.readFileSync(new URL('../app/admin/admin-symbols-panel.tsx', import.meta.url), 'utf8');
  const supportSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const profileSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const notificationsSource = fs.readFileSync(new URL('../app/notifications/notifications-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(buttonSource, /RefreshIconButton/);
  assert.match(buttonSource, /admin-refresh-icon-button refresh-icon-button/);
  assert.match(sharedButtonSource, /className=\{className\}/);
  assert.match(sharedButtonSource, /aria-label="새로고침"/);
  assert.match(sharedButtonSource, /M7\.2 8\.1A6\.8 6\.8 0 0 1 18\.8 9\.2/);
  assert.match(sharedButtonSource, /M18\.9 5\.1v4\.1h-4\.1/);
  assert.match(sharedButtonSource, /M16\.8 15\.9A6\.8 6\.8 0 0 1 5\.2 14\.8/);
  assert.match(sharedButtonSource, /M5\.1 18\.9v-4\.1h4\.1/);
  assert.match(dashboardSource, /AdminRefreshButton/);
  assert.match(symbolsSource, /AdminRefreshButton/);
  assert.match(supportSource, /RefreshIconButton/);
  assert.match(profileSource, /RefreshIconButton/);
  assert.match(notificationsSource, /RefreshIconButton/);
  assert.match(cssSource, /\.refresh-icon-button\s*\{[\s\S]*?background:\s*rgba\(125, 183, 255, 0\.1\)/);
  assert.match(cssSource, /\.refresh-icon-button\s*\{[\s\S]*?border:\s*1px solid transparent/);
  assert.match(cssSource, /\.refresh-icon-button svg\s*\{[\s\S]*?height:\s*20px/);
  assert.match(cssSource, /\.toolbar > \.refresh-icon-button\s*\{[\s\S]*?margin-left:\s*auto/);
  assert.match(cssSource, /\.toolbar-actions:has\(\.refresh-icon-button\),[\s\S]*?\.toolbar \.actions\.compact:has\(\.refresh-icon-button\)\s*\{[\s\S]*?margin-left:\s*auto/);
  assert.match(cssSource, /\.toolbar-actions > \.refresh-icon-button,[\s\S]*?\.toolbar \.actions\.compact > \.refresh-icon-button\s*\{[\s\S]*?order:\s*99/);
});

test('admin display ids use Korean labels with four digit minimum padding', () => {
  assert.equal(formatAdminDisplayId('결제', 1), '결제-0001');
  assert.equal(formatAdminDisplayId('구독', 2048), '구독-2048');
  assert.equal(formatAdminDisplayId('문의', 9999), '문의-9999');
  assert.equal(formatAdminDisplayId('회원', 10000), '회원-10000');
  assert.equal(formatAdminDisplayId('작업', 10001), '작업-10001');
  assert.equal(getAdminDisplaySequence([{ id: 'latest' }, { id: 'older' }], (item) => item.id === 'latest'), 2);
  assert.equal(getAdminDisplaySequence([{ id: 'latest' }, { id: 'older' }], (item) => item.id === 'older'), 1);
});
