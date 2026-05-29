import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  getWebInfoSettingsForDisplay,
  updateWebInfoSettings,
} from '../src/server/chart-service/index.ts';

test('web info settings default to signup terms and privacy content', () => {
  const repository = createMockChartServiceRepository();

  const settings = getWebInfoSettingsForDisplay(repository);

  assert.equal(settings.termsContent.length > 0, true);
  assert.equal(settings.privacyContent.length > 0, true);
  assert.deepEqual(settings.planServices.plan_monthly.slice(0, 3), [
    'TC Chart 접근',
    '유료 시그널 열람',
    '마이프로필 구독 상태 확인',
  ]);
});

test('admin can update signup terms, privacy policy, and plan service content', () => {
  const repository = createMockChartServiceRepository();
  const before = getWebInfoSettingsForDisplay(repository);

  const updated = updateWebInfoSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    termsContent: 'Updated terms content',
    privacyContent: 'Updated privacy content',
    planServices: {
      plan_monthly: ['월간 차트 접근', '월간 시그널 열람'],
      plan_half_year: ['6개월 전용 혜택'],
      plan_yearly: ['연간 전용 혜택'],
    },
    updatedAt: '2026-05-25T05:00:00.000Z',
  });

  assert.equal(updated.termsContent, 'Updated terms content');
  assert.equal(updated.privacyContent, 'Updated privacy content');
  assert.deepEqual(updated.planServices.plan_monthly, ['월간 차트 접근', '월간 시그널 열람']);
  assert.deepEqual(updated.planServices.plan_half_year, ['6개월 전용 혜택']);
  assert.deepEqual(updated.planServices.plan_yearly, ['연간 전용 혜택']);
  assert.equal(updated.updatedByAdminId, 'admin_1');
  assert.equal(repository.getWebInfoSettings()?.privacyContent, 'Updated privacy content');
  assert.deepEqual(repository.getWebInfoSettings()?.planServices.plan_yearly, ['연간 전용 혜택']);
  const auditLog = repository.listAuditLogs().at(-1);
  assert.equal(auditLog?.action, 'admin.web_info.settings.update');
  assert.equal(auditLog?.targetType, 'web_info_settings');
  assert.equal(auditLog?.targetId, 'default');
  assert.deepEqual(auditLog?.beforeJson, { settings: before });
  assert.deepEqual(auditLog?.afterJson, { settings: updated });
});

test('web info settings reject blank policy content', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateWebInfoSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    termsContent: '   ',
    privacyContent: 'Updated privacy content',
    planServices: {
      plan_monthly: ['월간 차트 접근'],
      plan_half_year: ['6개월 전용 혜택'],
      plan_yearly: ['연간 전용 혜택'],
    },
    updatedAt: '2026-05-25T05:00:00.000Z',
  }), /Terms content is required/);
});

test('web info settings reject blank plan service items', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateWebInfoSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    termsContent: 'Updated terms content',
    privacyContent: 'Updated privacy content',
    planServices: {
      plan_monthly: ['월간 차트 접근', '   '],
      plan_half_year: ['6개월 전용 혜택'],
      plan_yearly: ['연간 전용 혜택'],
    },
    updatedAt: '2026-05-25T05:00:00.000Z',
  }), /Plan services must not include blank items/);
});

test('admin web info panel and routes are wired into operations UI', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const sectionSource = fs.readFileSync(new URL('../app/admin/admin-web-info-section.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-web-info-panel.tsx', import.meta.url), 'utf8');
  const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/web-info/route.ts', import.meta.url), 'utf8');
  const publicRouteSource = fs.readFileSync(new URL('../app/api/web-info/route.ts', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminWebInfoSection/);
  assert.match(pageSource, /sectionKey="webInfo"/);
  assert.doesNotMatch(pageSource, /AdminPaymentSettingsPanel/);
  assert.match(sectionSource, /AdminWebInfoPanel/);
  assert.match(sectionSource, /AdminPaymentSettingsPanel/);
  assert.match(sectionSource, /AdminPointSettingsPanel/);
  assert.match(sectionSource, /admin-web-info-group/);
  assert.match(sectionSource, /aria-label="웹정보관리 세부 메뉴"/);
  assert.match(sectionSource, /가입약관/);
  assert.match(sectionSource, /개인정보보호정책/);
  assert.match(sectionSource, /입금정보관리/);
  assert.match(sectionSource, /포인트관리/);
  assert.match(sectionSource, /플랜 제공서비스/);
  assert.match(sectionSource, /href: '#admin-plan-services'/);
  assert.match(sectionSource, /href: '#admin-point-settings'/);
  assert.match(sectionSource, /getWebInfoPageFromHash/);
  assert.match(sectionSource, /hashchange/);
  assert.match(sectionSource, /activePage === 'terms'/);
  assert.match(sectionSource, /activePage === 'privacy'/);
  assert.match(sectionSource, /activePage === 'payments'/);
  assert.match(sectionSource, /activePage === 'points'/);
  assert.match(sectionSource, /activePage === 'planServices'/);
  assert.match(panelSource, /admin-web-info/);
  assert.match(panelSource, /mode: 'terms' \| 'privacy' \| 'planServices'/);
  assert.match(panelSource, /mode === 'terms'/);
  assert.match(panelSource, /termsContent/);
  assert.match(panelSource, /privacyContent/);
  assert.match(panelSource, /planServices/);
  assert.match(panelSource, /plan-services-grid/);
  assert.match(panelSource, /plan-services-help/);
  assert.match(panelSource, /plan-services-preview/);
  assert.match(panelSource, /제공서비스 미리보기/);
  assert.match(panelSource, /서비스 항목/);
  assert.match(panelSource, /플랜 제공서비스/);
  assert.match(panelSource, /parsePlanServiceLines/);
  assert.match(panelSource, /\/api\/admin\/web-info/);
  assert.match(panelSource, /dispatchAdminRefreshEvent/);
  assert.match(panelSource, /source: 'webInfo'/);
  assert.match(adminRouteSource, /updateAsyncWebInfoSettings/);
  assert.match(publicRouteSource, /getAsyncWebInfoSettingsForDisplay/);
});

test('admin web info submenu uses dark admin tab styling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const submenuRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const linkRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const activeRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a:hover,[\s\S]*?body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a\[aria-current="page"\]\s*\{(?<body>[^}]*)\}/,
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

test('admin web info save button centers its label', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const saveButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-form > \.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(saveButtonRule, /justify-content:\s*center/);
  assert.match(saveButtonRule, /text-align:\s*center/);
  assert.match(saveButtonRule, /width:\s*100%/);
});

test('admin payment settings save button centers its label', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const saveButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-payment-settings-form > \.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(saveButtonRule, /justify-content:\s*center/);
  assert.match(saveButtonRule, /text-align:\s*center/);
  assert.match(saveButtonRule, /width:\s*100%/);
});
