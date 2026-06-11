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
    'telegramAlerts',
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
  assert.match(panelSource, /EditActionIcon/);
  assert.match(panelSource, /DeleteActionIcon/);
  assert.match(panelSource, /action-icon-button edit/);
  assert.match(panelSource, /action-icon-button delete/);
  assert.doesNotMatch(panelSource, /className="button secondary" type="button" onClick=\{\(\) => startEdit\(symbol\)\}/);
  assert.doesNotMatch(panelSource, /className="button danger" type="button" onClick=\{\(\) => deleteSymbol\(symbol\)\}/);
  assert.match(cssSource, /\.admin-symbols-item\s*\{[\s\S]*?grid-template-columns: 38px minmax\(0, 1fr\)/);
  assert.match(cssSource, /\.admin-symbols-table th:nth-child\(2\),[\s\S]*?\.admin-symbols-table td:nth-child\(2\)\s*\{[\s\S]*?width:\s*82px/);
  assert.match(cssSource, /\.admin-symbols-icon\s*\{[\s\S]*?height: 38px/);
  assert.match(cssSource, /\.admin-symbols-icon img\s*\{[\s\S]*?object-fit: cover/);
});

test('admin symbol list exposes a chart apply toggle per symbol', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-symbols-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /isSymbolAppliedToChart/);
  assert.match(panelSource, /setSymbolChartApplied/);
  assert.match(panelSource, /toggleChartApplied\(symbol\)/);
  assert.match(panelSource, /aria-pressed=\{isApplied\}/);
  assert.match(panelSource, /admin-symbols-apply-switch/);
  assert.match(panelSource, /차트 적용/);
  assert.match(panelSource, /isApplied \? 'ON' : 'OFF'/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\s*\{/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\.active/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\s*\{[\s\S]*?border:\s*0/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\s*\{[\s\S]*?display:\s*inline-grid/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\s*\{[\s\S]*?justify-items:\s*center/);
  assert.match(cssSource, /\.admin-symbols-apply-switch\.active\s*\{[\s\S]*?background:\s*transparent/);
});

test('symbol registry persists chart application state for hidden symbols', () => {
  const catalogSource = fs.readFileSync(new URL('../src/catalog/symbols.ts', import.meta.url), 'utf8');

  assert.match(catalogSource, /hidden:\s*\[\.\.\.hiddenSymbols\]/);
  assert.match(catalogSource, /parsed\.hidden/);
  assert.match(catalogSource, /export function isSymbolAppliedToChart/);
  assert.match(catalogSource, /export function setSymbolChartApplied/);
  assert.match(catalogSource, /hiddenSymbols\.add\(normalized\)/);
  assert.match(catalogSource, /hiddenSymbols\.delete\(normalized\)/);
});

test('chart admin config keeps locally toggled symbol visibility', () => {
  const catalogSource = fs.readFileSync(new URL('../src/catalog/symbols.ts', import.meta.url), 'utf8');
  const loadAdminConfigSource = catalogSource.slice(
    catalogSource.indexOf('export async function loadAdminConfig'),
    catalogSource.indexOf('export function getAllSymbolCatalog'),
  );

  assert.doesNotMatch(loadAdminConfigSource, /hiddenSymbols\.clear\(\)/);
  assert.match(loadAdminConfigSource, /hiddenSymbols\.add\(normalizeCatalogSymbolId\(s\)\)/);
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
