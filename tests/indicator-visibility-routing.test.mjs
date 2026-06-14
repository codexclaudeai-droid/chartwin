import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panelModuleSource = fs.readFileSync(new URL('../src/indicator-panel-module.ts', import.meta.url), 'utf8');
const backgroundSource = fs.readFileSync(new URL('../src/chart/renderers/main-background-layer-orchestrator.ts', import.meta.url), 'utf8');
const mainIndicatorSource = fs.readFileSync(new URL('../src/chart/renderers/main-indicator-orchestrator.ts', import.meta.url), 'utf8');
const subPanelSource = fs.readFileSync(new URL('../src/chart/renderers/subpanel-render-orchestrator.ts', import.meta.url), 'utf8');
const crosshairSource = fs.readFileSync(new URL('../src/chart/renderers/subpanel-crosshair-value.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const modalHandlersSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const catalogSource = fs.readFileSync(new URL('../src/catalog/indicators.ts', import.meta.url), 'utf8');

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

test('Momentum is routed as a configurable subpanel indicator', () => {
  assert.match(catalogSource, /\{\s*id: 'momentum', label: 'Momentum', desc: 'Price momentum \(close - close n bars ago\)', panel: 'sub'\s*\}/);
  assert.match(panelModuleSource, /export type SubPanelId = 'volume' \| 'rsi' \| 'mfi' \| 'momentum'/);
  assert.match(panelModuleSource, /momentum:\s*\{\s*color: '#ffb74d', width: 1\.5, dash: \[\]\s*\}/);
  assert.match(panelModuleSource, /momentum:\s*\[\{\s*key: 'momentum', label: 'Line'\s*\}, \{\s*key: 'momentumBaseline', label: 'Baseline'\s*\}\]/);
  assert.match(simpleChartSource, /momentum:\s*\{\s*show:\s*false,\s*period:\s*10\s*\}/);
  assert.match(simpleChartSource, /const momentumD = indicatorLayerOn && ind\.momentum\.show\s+\?\s+this\.calcMomentum\(ind\.momentum\.period\)\s+:\s+\[\]/);
  assert.match(subPanelSource, /renderMomentumPanel\(\{ \.\.\.subPanelContext, period: ind\.momentum\.period, data: momentumD \}\)/);
  assert.match(crosshairSource, /if \(panelId === 'momentum'\) \{/);
  assert.match(modalHandlersSource, /momentum: \['period'\]/);
  assert.match(indicatorOverlaySource, /momentum:\s*\(\) => `MOM\(\$\{i\.momentum\?\.period \?\? 10\}\)`/);
});

test('Donchian Channel is routed as a configurable main overlay indicator', () => {
  assert.match(catalogSource, /\{\s*id: 'donchianChannel', label: 'Donchian Channel', desc: 'Highest high and lowest low price channel', panel: 'main'\s*\}/);
  assert.match(panelModuleSource, /donchianUpper:\s*\{\s*color: '#42a5f5', width: 1\.4, dash: \[\]\s*\}/);
  assert.match(panelModuleSource, /donchianChannel:\s*\[\s*\{\s*key: 'donchianUpper', label: 'Upper'\s*\},\s*\{\s*key: 'donchianMiddle', label: 'Middle'\s*\},\s*\{\s*key: 'donchianLower', label: 'Lower'\s*\},\s*\]/);
  assert.match(simpleChartSource, /donchianChannel:\s*\{\s*show:\s*false,\s*period:\s*20\s*\}/);
  assert.match(simpleChartSource, /const donchianChannelD\s+=\s+indicatorLayerOn && ind\.donchianChannel\.show\s+\?\s+this\.calcDonchianChannel\(ind\.donchianChannel\.period\)\s+:\s+null/);
  assert.match(backgroundSource, /renderDonchianChannelFill\(\{/);
  assert.match(mainIndicatorSource, /renderDonchianChannelLines\(\{/);
  assert.match(modalHandlersSource, /donchianChannel: \['period'\]/);
  assert.match(indicatorOverlaySource, /donchianChannel:\s*\(\) => `DC\(\$\{i\.donchianChannel\?\.period \?\? 20\}\)`/);
});
