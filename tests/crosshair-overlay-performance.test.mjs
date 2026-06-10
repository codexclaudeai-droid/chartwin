import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const subPanelCrosshairSource = fs.readFileSync(new URL('../src/chart/renderers/subpanel-crosshair-value.ts', import.meta.url), 'utf8');
const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');

test('trendline hover does not self-schedule overlay animation frames', () => {
  assert.doesNotMatch(
    simpleChartSource,
    /const hoveredTrendline =[\s\S]*?if \(hoveredTrendline && this\.isMouseOver\) \{\s*this\.requestOverlayDraw\(\);\s*\}/,
    'hovering a static trendline should not create a continuous overlay redraw loop',
  );
});

test('subpanel crosshair reuses indicator data from the latest main draw', () => {
  assert.match(
    simpleChartSource,
    /subPanelCrosshairData:/,
    'main draw metadata should retain the indicator series needed by subpanel crosshair labels',
  );
  assert.match(
    simpleChartSource,
    /const subPanelCrosshairData = this\.lastDrawMeta\?\.subPanelCrosshairData;/,
    'overlay draw should read cached subpanel indicator series from lastDrawMeta',
  );
  assert.doesNotMatch(
    simpleChartSource,
    /calcDMI: \(period\) => this\.calcDMI\(period\),/,
    'overlay draw should not recalculate DMI on every mouse move',
  );
  assert.doesNotMatch(
    simpleChartSource,
    /calcMACD: \(fast, slow, signal\) => this\.calcMACD\(fast, slow, signal\),/,
    'overlay draw should not recalculate MACD on every mouse move',
  );
  assert.match(
    subPanelCrosshairSource,
    /calcOBVSignal\?: \(\) => NullableSeries;/,
    'OBV signal data should be available as a cached crosshair input',
  );
  assert.match(
    subPanelCrosshairSource,
    /calcCVDSignal\?: \(\) => NullableSeries;/,
    'CVD signal data should be available as a cached crosshair input',
  );
});

test('indicator panel hover controls skip repeated DOM writes for the same panel', () => {
  assert.match(
    indicatorOverlaySource,
    /const applyHoveredPanel = \(nextId: string \| null\) => \{\s*if \(hoveredPanelId === nextId\) return;/,
    'panel hover state should only update DOM when the hovered panel actually changes',
  );
});
