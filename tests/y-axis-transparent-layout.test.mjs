import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('src/chart/SimpleChart.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const axisOverlaySource = fs.readFileSync(path.resolve('src/chart/renderers/axis-overlay-renderer.ts'), 'utf8');
const subPanelOrchestratorSource = fs.readFileSync(path.resolve('src/chart/renderers/subpanel-render-orchestrator.ts'), 'utf8');
const subPanelUtilsSource = fs.readFileSync(path.resolve('src/chart/renderers/subpanel-render-utils.ts'), 'utf8');
const subPanelCrosshairAxisSource = fs.readFileSync(path.resolve('src/chart/renderers/subpanel-crosshair-axis-renderer.ts'), 'utf8');

test('transparent Y-axis can still use the full visible width after the initial render', () => {
  assert.match(
    source,
    /const chartWidth = Math\.max\(1, \(transparentAxis \? width : chartRight\) - chartLeft\);/,
    'transparent Y-axis should still expose the full right-side region for later panning',
  );
});

test('horizontal pan uses chart geometry width instead of raw rightPadding subtraction', () => {
  assert.doesNotMatch(
    source,
    /const chartW = this\.viewportWidth - this\.config\.layout\.rightPadding;/,
    'pan math should use dynamic chart geometry width so transparent Y-axis does not change candle anchoring',
  );
});

test('initial and near-latest data loads realign the latest candle to the axis start', () => {
  assert.match(
    source,
    /if \(!prevData\.length\) \{\s*this\.alignLatestCandleToAxisStart\(Math\.min\(80, data\.length\)\);/s,
    'first load should use latest-candle alignment instead of attaching to the far right edge',
  );
  assert.match(
    source,
    /else if \(prevWasNearLatest\) \{\s*this\.alignLatestCandleToAxisStart\(Math\.min\(prevVisible, data\.length\)\);/s,
    'symbol changes and refreshes near the latest range should preserve the same initial anchor',
  );
});

test('latest candle alignment targets the same initial position as opaque Y-axis mode', () => {
  assert.match(
    source,
    /const opaqueChartW = Math\.max\(1, geometry\.axisLeft - geometry\.chartLeft\);/,
    'latest-candle anchor should derive its target from the opaque chart width',
  );
  assert.match(
    source,
    /const targetX = geometry\.chartLeft \+ \(realCount - 1\) \* opaqueTotalSp \+ opaqueCandleW;/,
    'transparent initial anchor should match the opaque-mode latest-candle position',
  );
});

test('transparent Y-axis redraws price labels as the final overlay layer', () => {
  assert.match(
    source,
    /if \(yAxisTransparent\) \{\s*renderTransparentYAxisLabels\(\{/s,
    'transparent Y-axis should redraw price labels in a dedicated late pass',
  );
  assert.match(
    axisOverlaySource,
    /const transparentAxisTextX = geometry\.side === 'left' \? geometry\.axisPad - 6 : chartRight \+ 4;/,
    'transparent Y-axis should place labels directly inside the axis strip like the indicator panels do',
  );
});

test('sub-panel Y-axis follows the selected market info side', () => {
  assert.match(
    source,
    /const subAxisStart = geometry\.side === 'left' \? 0 : width - geometry\.axisPad;/,
    'sub-panel axis strip should move left when the main market info side is left',
  );
  assert.match(
    source,
    /const subChartRight = geometry\.side === 'left' \? width : subAxisStart;/,
    'sub-panel plot extent should mirror the main chart side behavior',
  );
  assert.match(
    source,
    /if \(meta\.axisSide === 'right'\) \{\s*if \(x < meta\.subAxisStart\) return null;\s*\} else \{\s*if \(x < 0 \|\| x > meta\.axisPad\) return null;\s*\}/s,
    'sub-panel Y-axis mouse hit testing should use the active axis side',
  );
  assert.match(
    subPanelOrchestratorSource,
    /geometry: \{ axisPad: number; side: 'left' \| 'right' \};/,
    'sub-panel render orchestration should receive the Y-axis side, not only the width',
  );
  assert.match(
    subPanelOrchestratorSource,
    /ctx\.fillRect\(subAxisStart, top, geometry\.axisPad, pH\);[\s\S]*ctx\.moveTo\(geometry\.side === 'left' \? subAxisStart \+ geometry\.axisPad - 0\.5 : subAxisStart - 0\.5, top\);/,
    'opaque sub-panel axis background and boundary should render on the active side',
  );
  assert.match(
    subPanelUtilsSource,
    /ctx\.textAlign = axisSide === 'left' \? 'right' : 'left';/,
    'sub-panel grid labels should align to the active Y-axis side',
  );
  assert.match(
    subPanelUtilsSource,
    /const boxX = axisSide === 'left' \? 2 : width - boxW - 2;/,
    'sub-panel value and alert boxes should anchor to the active Y-axis side',
  );
  assert.match(
    subPanelCrosshairAxisSource,
    /const boxX = axisSide === 'left' \? 2 : width - boxWidth - 2;/,
    'sub-panel crosshair value box should anchor to the active Y-axis side',
  );
});
