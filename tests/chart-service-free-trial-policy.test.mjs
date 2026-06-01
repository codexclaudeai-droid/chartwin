import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  getAsyncFreeTrialPolicySettings,
  updateAsyncFreeTrialPolicySettings,
} from '../src/server/chart-service/index.ts';

test('admins can update global free trial event policy settings', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());

  const settings = await updateAsyncFreeTrialPolicySettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    baseDurationDays: 7,
    eventEnabled: true,
    eventStartsAt: '2026-06-01T00:00:00.000Z',
    eventEndsAt: '2026-06-10T00:00:00.000Z',
    eventDurationDays: 14,
    eventAllowReapply: true,
    updatedAt: '2026-06-01T00:00:00.000Z',
  });
  const reloaded = await getAsyncFreeTrialPolicySettings(repository, '2026-06-02T00:00:00.000Z');
  const auditEntries = await repository.listAuditLogs();

  assert.equal(settings.eventEnabled, true);
  assert.equal(settings.eventAllowReapply, true);
  assert.equal(settings.eventDurationDays, 14);
  assert.equal(reloaded.eventDurationDays, 14);
  assert.equal(auditEntries.at(-1)?.action, 'admin.free_trial_policy.update');
});

test('admin free trial policy panel is reachable from subscription management', () => {
  const sectionSource = readFileSync(new URL('../app/admin/admin-subscription-section.tsx', import.meta.url), 'utf8');
  const webInfoSource = readFileSync(new URL('../app/admin/admin-web-info-section.tsx', import.meta.url), 'utf8');
  const panelSource = readFileSync(new URL('../app/admin/admin-trial-policy-panel.tsx', import.meta.url), 'utf8');
  const routeSource = readFileSync(new URL('../app/api/admin/trial-policy/route.ts', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(sectionSource, /AdminTrialPolicyPanel/);
  assert.match(sectionSource, /admin-trial-policy/);
  assert.doesNotMatch(webInfoSource, /AdminTrialPolicyPanel/);
  assert.match(panelSource, /\/api\/admin\/trial-policy/);
  assert.match(panelSource, /eventAllowReapply/);
  assert.match(cssSource, /input\[type="datetime-local"\]::-webkit-calendar-picker-indicator/);
  assert.match(
    cssSource,
    /@media \(max-width: 640px\)[\s\S]*?#admin-trial-policy \.settings-grid label:nth-child\(3\),[\s\S]*?#admin-trial-policy \.settings-grid label:nth-child\(4\)\s*\{[\s\S]*?grid-column:\s*1 \/ -1/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 640px\)[\s\S]*?#admin-trial-policy input\[type="datetime-local"\]\s*\{[\s\S]*?font-size:\s*13px[\s\S]*?width:\s*100%/,
  );
  assert.match(routeSource, /updateAsyncFreeTrialPolicySettings/);
});
