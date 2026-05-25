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
});

test('admin dashboard shell maps legacy anchors and deep links to sidebar sections', () => {
  assert.equal(getAdminDashboardSectionFromLocation(''), 'overview');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-overview'), 'overview');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info-terms'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-web-info-privacy'), 'webInfo');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-statistics'), 'statistics');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-sales'), 'sales');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-users'), 'users');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-payment-settings'), 'paymentSettings');
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
  assert.match(pageSource, /sectionKey="overview"[\s\S]*sectionKey="webInfo"[\s\S]*sectionKey="users"[\s\S]*sectionKey="support"[\s\S]*sectionKey="payments"[\s\S]*sectionKey="subscriptions"[\s\S]*sectionKey="sales"[\s\S]*sectionKey="statistics"[\s\S]*sectionKey="audit"/);
  assert.match(pageSource, /AdminDashboardShellSection sectionKey="paymentSettings"/);
  assert.match(shellSource, /admin-dashboard-sidebar/);
  assert.doesNotMatch(shellSource, /admin-dashboard-workspace-header/);
  assert.doesNotMatch(shellSource, /activeSectionMeta/);
  assert.doesNotMatch(cssSource, /admin-dashboard-workspace-header/);
  assert.match(shellSource, /data-active-admin-section=\{activeSection\}/);
  assert.match(shellSource, /scrollIntoView\(\{ block: 'start'/);
  assert.match(cssSource, /\.admin-dashboard-shell/);
  assert.match(cssSource, /\.admin-dashboard-sidebar/);
  assert.match(cssSource, /\.admin-dashboard-section\[hidden\]/);
});
