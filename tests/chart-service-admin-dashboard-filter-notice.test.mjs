import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('admin dashboard filter notice component explains queue-applied filters and can clear them', () => {
  const source = readSource('../app/admin/admin-dashboard-filter-notice.tsx');

  assert.match(source, /AdminDashboardFilterNotice/);
  assert.match(source, /role="status"/);
  assert.match(source, /admin-dashboard-filter-notice/);
  assert.match(source, /admin-dashboard-filter-copy/);
  assert.match(source, /admin-dashboard-filter-badge/);
  assert.match(source, /대시보드 이동/);
  assert.match(source, /대시보드 큐에서/);
  assert.match(source, /\{label\} 필터 적용됨/);
  assert.match(source, /onClick=\{onClear\}/);
  assert.match(source, /전체 보기/);
});

test('admin dashboard filter notice has a stronger visual treatment for dashboard-routed filters', () => {
  const source = readSource('../app/globals.css');

  assert.match(source, /\.admin-dashboard-filter-copy/);
  assert.match(source, /\.admin-dashboard-filter-badge/);
  assert.match(source, /text-transform: uppercase/);
  assert.match(source, /letter-spacing: 0\.08em/);
  assert.match(source, /box-shadow: 0 14px 30px/);
  assert.match(source, /@media \(max-width: 720px\)/);
  assert.match(source, /\.admin-dashboard-filter-notice/);
  assert.match(source, /align-items: flex-start/);
});

test('manual operation panels show and clear dashboard queue filter notices', () => {
  const paymentSource = readSource('../app/admin/admin-panel.tsx');
  const subscriptionSource = readSource('../app/admin/subscription-admin-panel.tsx');
  const supportSource = readSource('../app/admin/support-admin-panel.tsx');

  for (const source of [paymentSource, subscriptionSource, supportSource]) {
    assert.match(source, /AdminDashboardFilterNotice/);
    assert.match(source, /dashboardFilterNotice/);
    assert.match(source, /setDashboardFilterNotice\(dashboardFilter\.label\)/);
    assert.match(source, /setDashboardFilterNotice\(null\)/);
    assert.match(source, /onClear=\{clearDashboardFilterNotice\}/);
  }
});

test('admin user panel shows and clears dashboard account-status filter notices', () => {
  const source = readSource('../app/admin/user-admin-panel.tsx');

  assert.match(source, /AdminDashboardFilterNotice/);
  assert.match(source, /dashboardFilterNotice/);
  assert.match(source, /setDashboardFilterNotice\(formatUserAccountStatusLabel\('suspended'\)\)/);
  assert.match(source, /function clearDashboardFilterNotice/);
  assert.match(source, /refresh\(\{ accountStatus: 'all' \}\)/);
});
