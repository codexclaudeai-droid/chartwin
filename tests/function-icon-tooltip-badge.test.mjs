import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const topBarSource = fs.readFileSync(new URL('../src/ui/workspace/top-bar.ts', import.meta.url), 'utf8');
const paneChromeSource = fs.readFileSync(new URL('../src/ui/workspace/pane-chrome.ts', import.meta.url), 'utf8');
const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const strategyReportSource = fs.readFileSync(new URL('../src/ui/workspace/strategy-report-panel.ts', import.meta.url), 'utf8');

test('top function icons share the unified bottom tooltip badge placement', () => {
  assert.match(topBarSource, /const TOP_ICON_TOOLTIP = \{ placement: 'bottom' as const, align: 'center' as const, offset: 8 \}/);
  assert.match(topBarSource, /iconBtn\(calendarSvgIcon, '경제달력'/);
  assert.match(topBarSource, /iconBtn\(screenshotSvgIcon, '스크린샷'/);
  assert.match(topBarSource, /iconBtn\(fullscreenSvgIcon, '풀스크린 \(F\)'/);
  assert.match(topBarSource, /iconBtn\(settingsSvgIcon, '설정'/);
  assert.match(topBarSource, /bindTooltipBadge\(signalBtn,[\s\S]*\.\.\.TOP_ICON_TOOLTIP/);
  assert.match(topBarSource, /bindTooltipBadge\(splitBtn,[\s\S]*\.\.\.TOP_ICON_TOOLTIP/);
});

test('pane and report function icons use one centered badge placement per area', () => {
  assert.match(paneChromeSource, /const HEADER_ICON_TOOLTIP = \{ placement: 'bottom' as const, align: 'center' as const, offset: 8 \}/);
  assert.match(paneChromeSource, /bindTooltipBadge\(indBtn,[\s\S]*\.\.\.HEADER_ICON_TOOLTIP/);
  assert.match(paneChromeSource, /bindTooltipBadge\(strategyBtn,[\s\S]*\.\.\.HEADER_ICON_TOOLTIP/);
  assert.match(indicatorOverlaySource, /const OVERLAY_ICON_TOOLTIP = \{ placement: 'top' as const, align: 'center' as const, offset: 8 \}/);
  assert.match(indicatorOverlaySource, /bindTooltipBadge\(reportBtn,[\s\S]*\.\.\.OVERLAY_ICON_TOOLTIP/);
  assert.match(strategyReportSource, /const REPORT_ICON_TOOLTIP = \{ align: 'center' as const, offset: 8 \}/);
  assert.match(strategyReportSource, /const getHeaderTooltipPlacement = \(\): 'top' \| 'bottom' => \(panelMode === 'expanded' \? 'bottom' : 'top'\)/);
  assert.match(strategyReportSource, /bindTooltipBadge\(timeframeBtn,[\s\S]*placement: getHeaderTooltipPlacement/);
});
