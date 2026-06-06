import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panelModuleSource = fs.readFileSync(new URL('../src/indicator-panel-module.ts', import.meta.url), 'utf8');
const backgroundSource = fs.readFileSync(new URL('../src/chart/renderers/main-background-layer-orchestrator.ts', import.meta.url), 'utf8');
const mainIndicatorSource = fs.readFileSync(new URL('../src/chart/renderers/main-indicator-orchestrator.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const modalHandlersSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');

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

test('Smart Money Concepts hide action gates the whole renderer through style visibility', () => {
  assert.match(mainIndicatorSource, /import \{ INDICATOR_STYLE_TARGETS \} from '\.\.\/\.\.\/indicator-panel-module\.ts'/);
  assert.match(mainIndicatorSource, /function isIndicatorStyleTargetVisible\(indicatorKey: string, showLine: \(key: string\) => boolean\): boolean/);
  assert.match(
    mainIndicatorSource,
    /const smartMoneyConceptsVisible = isIndicatorStyleTargetVisible\('smartMoneyConcepts', showLine\)/,
  );
  assert.match(
    mainIndicatorSource,
    /if \(indicatorLayerOn && ind\.smartMoneyConcepts\?\.show && smartMoneyConceptsVisible\) \{/,
  );
});

test('turning an indicator back on restores hidden style visibility targets', () => {
  assert.match(modalHandlersSource, /const restoreIndicatorStyleVisibility = \(targetKey: string\) => \{/);
  assert.match(modalHandlersSource, /styleKeys\.forEach\(\(styleKey\) => chart\.setIndicatorLineVisible\?\.\(styleKey, true\)\)/);
  assert.match(modalHandlersSource, /if \(nextOn\) restoreIndicatorStyleVisibility\(ind\.id\);/);
});

test('VWAP defaults to TradingView-style session anchor with automatic exchange timezone', () => {
  assert.match(simpleChartSource, /vwap:\s*\{\s*show:\s*false,\s*anchorPeriod:\s*'session',\s*source:\s*'hlc3',\s*offset:\s*0,\s*hideOnDailyOrAbove:\s*false,\s*sessionTimezone:\s*'auto',\s*bandMode:\s*'standard-deviation'/);
  assert.match(simpleChartSource, /anchorPeriod:\s*vwapOptions\.anchorPeriod \?\? 'session'/);
  assert.match(modalHandlersSource, /ind\.anchorPeriod = 'session'/);
  assert.match(modalHandlersSource, /Bands Settings/);
  assert.match(modalHandlersSource, /Band Calculation Mode/);
  assert.match(modalHandlersSource, /Line Style/);
  assert.match(modalHandlersSource, /createColorBox/);
  assert.match(simpleChartSource, /fillOpacity:\s*8/);
  assert.match(panelModuleSource, /vwapUpper1/);
  assert.match(mainIndicatorSource, /vwapBandsD\.upper\[bandIndex\]/);
  assert.match(simpleChartSource, /private findVwapLineHit\(mx: number, my: number\): boolean/);
  assert.match(simpleChartSource, /private getVwapAnchorMarkerIndices\(result: VwapResult\): number\[\]/);
  assert.match(simpleChartSource, /private openVwapSettingsFromAnchor\(\): void/);
  assert.match(indicatorOverlaySource, /chart-open-indicator-settings/);
});
