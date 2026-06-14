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

test('passive mouse hover is coalesced to animation frames', () => {
  assert.match(
    simpleChartSource,
    /private passiveMouseMoveScheduled = false;/,
    'passive mouse hover should keep one pending animation-frame update',
  );
  assert.match(
    simpleChartSource,
    /private schedulePassiveMouseHover\(e: MouseEvent\): void \{[\s\S]*?window\.requestAnimationFrame/,
    'passive mousemove events should be coalesced through requestAnimationFrame',
  );
  assert.match(
    simpleChartSource,
    /const passiveHoverOnly = !this\.xAxisDragging[\s\S]*?!this\.isDragging;[\s\S]*?if \(passiveHoverOnly\) \{\s*this\.schedulePassiveMouseHover\(e\);\s*return;\s*\}/,
    'non-drag hover moves should avoid the immediate heavy mousemove path',
  );
});

test('cursor style writes only when the resolved cursor changes', () => {
  assert.match(
    simpleChartSource,
    /private lastCanvasCursor = '';/,
    'cursor state should remember the last DOM value',
  );
  assert.match(
    simpleChartSource,
    /const nextCursor = resolveChartCursor\(/,
    'cursor resolution should be stored before writing to the canvas style',
  );
  assert.match(
    simpleChartSource,
    /if \(this\.lastCanvasCursor !== nextCursor\) \{\s*this\.canvas\.style\.cursor = nextCursor;\s*this\.lastCanvasCursor = nextCursor;\s*\}/,
    'canvas cursor style should only be written when the value changes',
  );
});

test('passive hover draws overlay in the same animation frame', () => {
  assert.match(
    simpleChartSource,
    /private drawOverlayNow\(\): void \{[\s\S]*?this\.drawOverlay\(\);/,
    'overlay draw should have a reusable immediate draw path',
  );
  assert.match(
    simpleChartSource,
    /private updatePassiveMouseHover\(clientX: number, clientY: number\): void \{[\s\S]*?this\.drawOverlayNow\(\);/,
    'passive hover should update and draw the crosshair in the same animation frame',
  );
});

test('log button positioning avoids layout work when the pointer is away from the axis', () => {
  assert.match(
    simpleChartSource,
    /const onAxis = this\.isOnMainYAxis\(this\.mouseX, this\.mouseY\) \|\| this\.yAxisDragging \|\| this\._logBtnHovered;\s*if \(!onAxis\) \{\s*this\.scheduleLogBtnHide\(\);\s*return;\s*\}[\s\S]*?const btnW = this\.logBtn\.offsetWidth/,
    'normal cursor movement away from the Y axis should not read offsetWidth or rewrite button position',
  );
  assert.match(
    simpleChartSource,
    /if \(this\.lastLogBtnLeft !== left\) \{\s*this\.logBtn\.style\.left = `\$\{left\}px`;\s*this\.lastLogBtnLeft = left;\s*\}/,
    'log button left position should only be written when it changes',
  );
});
