import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard exposes symbol management as its own section', () => {
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

  const symbolsSection = ADMIN_DASHBOARD_SECTIONS.find((section) => section.key === 'symbols');
  assert.equal(symbolsSection?.href, '#admin-symbols');
  assert.equal(symbolsSection?.label, '종목관리');
  assert.equal(getAdminDashboardSectionFromLocation('#admin-symbols'), 'symbols');
});

test('admin symbol list shows registered symbol images before the symbol text', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-symbols-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /className="admin-symbols-item"/);
  assert.match(panelSource, /className="admin-symbols-icon"/);
  assert.match(panelSource, /getSymbolIconUrl/);
  assert.match(panelSource, /const iconUrl = getManagedSymbolIconUrl\(symbol\)/);
  assert.match(panelSource, /iconUrl \?/);
  assert.match(panelSource, /src=\{iconUrl\}/);
  assert.match(panelSource, /alt=\{symbol\.item\.label\}/);
  assert.match(panelSource, /className="admin-symbols-icon-fallback"/);
  assert.match(cssSource, /\.admin-symbols-item\s*\{[\s\S]*?grid-template-columns: 38px minmax\(0, 1fr\)/);
  assert.match(cssSource, /\.admin-symbols-icon\s*\{[\s\S]*?height: 38px/);
  assert.match(cssSource, /\.admin-symbols-icon img\s*\{[\s\S]*?object-fit: cover/);
});

test('admin page renders the symbol management panel inside the dashboard shell', () => {
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-symbols-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /AdminSymbolsPanel/);
  assert.match(pageSource, /sectionKey="webInfo"[\s\S]*sectionKey="symbols"[\s\S]*sectionKey="users"/);
  assert.match(panelSource, /종목관리/);
  assert.match(panelSource, /SYMBOL_CATALOG/);
  assert.match(panelSource, /CUSTOM_SYMBOLS/);
  assert.match(panelSource, /persistSymbolRegistry/);
  assert.match(panelSource, /admin-symbols-panel/);
});

test('chart settings no longer contains user-facing symbol registry controls', () => {
  const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
  const chartSettingsSource = modalSource.slice(
    modalSource.indexOf('export function openChartSettingsModal'),
    modalSource.indexOf('export function openSymbolRegistryModal'),
  );
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(chartSettingsSource, /openSymbolRegistryModal\(chart/);
  assert.doesNotMatch(chartSettingsSource, /심볼 등록 \/ 관리/);
  assert.doesNotMatch(chartSettingsSource, /심볼 관리/);
  assert.doesNotMatch(initSource, /openSymbolRegistryModal,\n/);
});
