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
});

test('admin can update signup terms and privacy policy content', () => {
  const repository = createMockChartServiceRepository();

  const updated = updateWebInfoSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    termsContent: 'Updated terms content',
    privacyContent: 'Updated privacy content',
    updatedAt: '2026-05-25T05:00:00.000Z',
  });

  assert.equal(updated.termsContent, 'Updated terms content');
  assert.equal(updated.privacyContent, 'Updated privacy content');
  assert.equal(updated.updatedByAdminId, 'admin_1');
  assert.equal(repository.getWebInfoSettings()?.privacyContent, 'Updated privacy content');
});

test('web info settings reject blank policy content', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateWebInfoSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    termsContent: '   ',
    privacyContent: 'Updated privacy content',
    updatedAt: '2026-05-25T05:00:00.000Z',
  }), /Terms content is required/);
});

test('admin web info panel and routes are wired into operations UI', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-web-info-panel.tsx', import.meta.url), 'utf8');
  const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/web-info/route.ts', import.meta.url), 'utf8');
  const publicRouteSource = fs.readFileSync(new URL('../app/api/web-info/route.ts', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminWebInfoPanel/);
  assert.match(pageSource, /AdminPointSettingsPanel/);
  assert.match(pageSource, /sectionKey="webInfo"/);
  assert.match(pageSource, /admin-web-info-group/);
  assert.match(pageSource, /aria-label="웹정보관리 세부 메뉴"/);
  assert.match(pageSource, /가입약관/);
  assert.match(pageSource, /개인정보보호정책/);
  assert.match(pageSource, /입금정보관리/);
  assert.match(pageSource, /포인트관리/);
  assert.match(pageSource, /href="#admin-point-settings"/);
  assert.match(panelSource, /admin-web-info/);
  assert.match(panelSource, /termsContent/);
  assert.match(panelSource, /privacyContent/);
  assert.match(panelSource, /\/api\/admin\/web-info/);
  assert.match(adminRouteSource, /updateAsyncWebInfoSettings/);
  assert.match(publicRouteSource, /getAsyncWebInfoSettingsForDisplay/);
});
