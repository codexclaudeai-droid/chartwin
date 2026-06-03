import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panelModuleSource = fs.readFileSync(new URL('../src/indicator-panel-module.ts', import.meta.url), 'utf8');
const backgroundSource = fs.readFileSync(new URL('../src/chart/renderers/main-background-layer-orchestrator.ts', import.meta.url), 'utf8');
const mainIndicatorSource = fs.readFileSync(new URL('../src/chart/renderers/main-indicator-orchestrator.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

test('VPVR hide action routes through its own render visibility key', () => {
  assert.match(panelModuleSource, /vpvr:\s*\[\s*\{\s*key:\s*'vpvr',\s*label:\s*'Line'\s*\}\s*\]/);
  assert.match(backgroundSource, /enabled:\s*indicatorLayerOn && indicators\.vpvr\.show && showLine\('vpvr'\)/);
});

test('Statistical Trailing Stop hide action also hides fills and trail markers', () => {
  assert.match(
    mainIndicatorSource,
    /const statisticalTrailingStopVisible = showLine\('statisticalTrailingStopBull'\) \|\| showLine\('statisticalTrailingStopBear'\)/,
  );
  assert.match(
    mainIndicatorSource,
    /if \(indicatorLayerOn && ind\.statisticalTrailingStop\.show && statisticalTrailingStopVisible\) \{/,
  );
});

test('Statistical Trailing Stop marker size is reduced on mobile chart viewports', () => {
  assert.match(mainIndicatorSource, /isMobileViewport\?: boolean/);
  assert.match(mainIndicatorSource, /getStatisticalTrailingStopMarkerGeometry\(pixelRatio, isMobileViewport\)/);
  assert.match(simpleChartSource, /const isMobileIndicatorViewport = \(window\.matchMedia\?\.\('\(pointer: coarse\)'\)\.matches \?\? false\) \|\| window\.innerWidth <= 768/);
  assert.match(simpleChartSource, /isMobileViewport: isMobileIndicatorViewport/);
});
