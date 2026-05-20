import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('src/chart/SimpleChart.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

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

test('transparent Y-axis renders readable price labels with local backplates', () => {
  assert.match(
    source,
    /function drawReadableAxisLabel\(/,
    'transparent Y-axis should have a dedicated readable label helper',
  );
  assert.match(
    source,
    /if \(yAxisTransparent\) \{\s*drawReadableAxisLabel\(/s,
    'transparent Y-axis tick labels should render with a local backdrop instead of bare text over candles',
  );
});
