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
  const subscriptionSectionSource = fs.readFileSync(new URL('../app/admin/admin-subscription-section.tsx', import.meta.url), 'utf8');
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
  assert.doesNotMatch(sectionSource, /href: '#admin-plan-services'/);
  assert.doesNotMatch(sectionSource, /activePage === 'planServices'/);
  assert.match(subscriptionSectionSource, /플랜 제공서비스/);
  assert.match(subscriptionSectionSource, /href: '#admin-plan-services'/);
  assert.match(subscriptionSectionSource, /activePage === 'planServices'/);
  assert.match(subscriptionSectionSource, /AdminWebInfoPanel mode="planServices"/);
  assert.match(sectionSource, /href: '#admin-point-settings'/);
  assert.match(sectionSource, /getWebInfoPageFromHash/);
  assert.match(sectionSource, /hashchange/);
  assert.match(sectionSource, /activePage === 'terms'/);
  assert.match(sectionSource, /activePage === 'privacy'/);
  assert.match(sectionSource, /activePage === 'payments'/);
  assert.match(sectionSource, /activePage === 'points'/);
  assert.match(panelSource, /admin-web-info/);
  assert.match(panelSource, /mode: 'terms' \| 'privacy' \| 'planServices'/);
  assert.match(panelSource, /mode === 'terms'/);
  assert.match(panelSource, /termsContent/);
  assert.match(panelSource, /privacyContent/);
  assert.match(panelSource, /planServices/);
  assert.match(panelSource, /plan-services-grid/);
  assert.match(panelSource, /plan-services-help/);
  assert.match(panelSource, /plan-services-preview/);
  assert.match(panelSource, /plan-services-editor-card/);
  assert.match(panelSource, /plan-services-row-list/);
  assert.match(panelSource, /plan-services-row/);
  assert.match(panelSource, /updatePlanServiceItem/);
  assert.match(panelSource, /addPlanServiceItem/);
  assert.match(panelSource, /removePlanServiceItem/);
  assert.match(panelSource, /AddRowActionIcon/);
  assert.match(panelSource, /label="행추가"/);
  assert.match(panelSource, /className="action-icon-button add"/);
  assert.match(panelSource, /DeleteActionIcon/);
  assert.match(panelSource, /IconButton/);
  assert.match(panelSource, /className="action-icon-button delete"/);
  assert.doesNotMatch(panelSource, /className="button danger compact"[\s\S]*removePlanServiceItem/);
  assert.doesNotMatch(panelSource, />행 추가</);
  assert.match(panelSource, /web-info-policy-editor/);
  assert.match(panelSource, /web-info-html-option/);
  assert.match(panelSource, /HTML 입력 가능/);
  assert.match(panelSource, /<h3>제목<\/h3><p>내용<\/p>/);
  assert.match(panelSource, /제공서비스 미리보기/);
  assert.match(panelSource, /서비스 항목/);
  assert.match(panelSource, /플랜 제공서비스/);
  assert.doesNotMatch(panelSource, /parsePlanServiceLines/);
  assert.match(panelSource, /\/api\/admin\/web-info/);
  assert.match(panelSource, /dispatchAdminRefreshEvent/);
  assert.match(panelSource, /source: 'webInfo'/);
  assert.match(adminRouteSource, /updateAsyncWebInfoSettings/);
  assert.match(publicRouteSource, /getAsyncWebInfoSettingsForDisplay/);
});

test('admin web info submenu uses dark admin tab styling', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const submenuRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs[\s\S]*?\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const linkRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a[\s\S]*?\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const activeRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a:hover,[\s\S]*?body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-tabs a\[aria-current="page"\][\s\S]*?\{(?<body>[^}]*)\}/,
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

test('global button style centers labels by default', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const baseButtonRule = cssSource.match(
    /\.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(baseButtonRule, /display:\s*inline-flex/);
  assert.match(baseButtonRule, /align-items:\s*center/);
  assert.match(baseButtonRule, /justify-content:\s*center/);
  assert.match(baseButtonRule, /text-align:\s*center/);
});

test('admin web info save button keeps full width while using global label centering', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const saveButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-web-info-form > \.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(saveButtonRule, /width:\s*100%/);
});

test('admin web info policy editor supports HTML input and uses 90 percent card width', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const editorRule = cssSource.match(
    /\.admin-web-info-form \.web-info-policy-editor\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';
  const textareaRule = cssSource.match(
    /\.admin-web-info-form \.web-info-policy-editor textarea\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(editorRule, /width:\s*90%/);
  assert.match(editorRule, /margin-inline:\s*auto/);
  assert.match(textareaRule, /width:\s*100%/);
});

test('admin plan service editor separates each service into editable rows', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const cardRule = cssSource.match(/\.plan-services-editor-card\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const rowRule = cssSource.match(/\.plan-services-row\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

  assert.match(cardRule, /display:\s*grid/);
  assert.match(rowRule, /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
});

test('admin payment settings save button keeps full width while using global label centering', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const saveButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-payment-settings-form > \.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(saveButtonRule, /width:\s*100%/);
});

test('admin payment bank logo upload keeps icon and help text centered in the picker box', () => {
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-payment-settings-panel.tsx', import.meta.url), 'utf8');
  const controlRule = cssSource.match(/\.bank-logo-upload-control\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const contentRule = cssSource.match(/\.bank-logo-upload-content\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const iconRule = cssSource.match(/\.bank-logo-upload-icon\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const previewRule = cssSource.match(/\.bank-logo-preview\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

  assert.match(panelSource, /bank-logo-upload-control/);
  assert.match(panelSource, /bank-logo-upload-icon/);
  assert.doesNotMatch(panelSource, /<strong>파일 선택<\/strong>/);
  assert.match(controlRule, /display:\s*grid/);
  assert.match(controlRule, /position:\s*relative/);
  assert.match(controlRule, /background:\s*rgba\(3, 11, 24, 0\.86\)/);
  assert.match(iconRule, /background:\s*rgba\(2, 7, 19, 0\.96\)/);
  assert.match(iconRule, /color:\s*rgba\(255, 255, 255, 0\.74\)/);
  assert.doesNotMatch(iconRule, /border:/);
  assert.match(iconRule, /padding:\s*5px/);
  assert.match(previewRule, /background:\s*rgba\(3, 11, 24, 0\.86\)/);
  assert.match(contentRule, /align-content:\s*center/);
  assert.match(contentRule, /justify-items:\s*center/);
  assert.match(contentRule, /text-align:\s*center/);
});

test('admin point settings save button keeps full width while using global label centering', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-point-settings-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const saveButtonRule = cssSource.match(
    /body:not\(:has\(\.landing-page\)\) #admin-section-webInfo \.admin-point-settings-form > \.button\s*\{(?<body>[^}]*)\}/,
  )?.groups?.body ?? '';

  assert.match(panelSource, /salesTeamRewardPercent/);
  assert.match(panelSource, /영업팀 포인트/);
  assert.match(panelSource, /salesTeamRewardPercent: 50/);
  assert.match(saveButtonRule, /width:\s*100%/);
});
