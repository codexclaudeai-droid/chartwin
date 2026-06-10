import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('footprint aggregation caps per-candle levels and maps maker side to aggressor side', () => {
  const source = fs.readFileSync(new URL('../src/chart/footprint/footprint-aggregation.ts', import.meta.url), 'utf8');

  assert.match(source, /MAX_FOOTPRINT_LEVELS_PER_CANDLE = 160/);
  assert.match(source, /next\.sort\(\(a, b\) => b\.totalVolume - a\.totalVolume\)/);
  assert.match(source, /if \(isBuyerMaker === true\) return 'sell'/);
  assert.match(source, /if \(isBuyerMaker === false\) return 'buy'/);
});

test('footprint renderer only draws when candles are sufficiently zoomed', () => {
  const rendererSource = fs.readFileSync(new URL('../src/chart/renderers/footprint-renderer.ts', import.meta.url), 'utf8');
  const chartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

  assert.match(rendererSource, /MIN_FOOTPRINT_SLOT_WIDTH = 48/);
  assert.match(rendererSource, /if \(totalSpacing < MIN_FOOTPRINT_SLOT_WIDTH \|\| candleWidth < 2\) return/);
  assert.match(rendererSource, /getVisibleFootprintLevels/);
  assert.match(rendererSource, /formatFootprintVolume\(level\.sellVolume\)/);
  assert.match(rendererSource, /formatFootprintVolume\(level\.buyVolume\)/);
  assert.match(rendererSource, /groupFootprintLevelsByPriceStep\(levels, priceStep\)/);
  assert.match(rendererSource, /Delta \$\{formatFootprintVolume\(delta\)\}/);
  assert.match(rendererSource, /Total \$\{formatFootprintVolume\(total\)\}/);
  assert.match(chartSource, /import \{ renderFootprintOverlay \} from '\.\/renderers\/footprint-renderer\.ts'/);
  assert.match(chartSource, /renderFootprintOverlay\(\{/);
});

test('footprint renderer has a dedicated two-decimal K/M volume formatter', () => {
  const rendererSource = fs.readFileSync(new URL('../src/chart/renderers/footprint-renderer.ts', import.meta.url), 'utf8');

  assert.match(rendererSource, /export function formatFootprintVolume\(value: number\): string/);
  assert.match(rendererSource, /scaled\.toFixed\(2\)/);
  assert.match(rendererSource, /abs >= 1_000_000/);
  assert.match(rendererSource, /abs >= 1_000/);
});

test('footprint is registered as a main indicator with settings controls', () => {
  const catalogSource = fs.readFileSync(new URL('../src/catalog/indicators.ts', import.meta.url), 'utf8');
  const chartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
  const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
  const overlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');

  assert.match(catalogSource, /id: 'footprint'[\s\S]*panel: 'main'/);
  assert.match(chartSource, /footprint: \{ show: false, showSummary: true, maxLevels: 18, priceStep: 1000 \}/);
  assert.match(chartSource, /indicatorLayerOn && ind\.footprint\.show/);
  assert.match(chartSource, /priceStep: Math\.max\(0, Number\(ind\.footprint\.priceStep\) \|\| 0\)/);
  assert.match(modalSource, /popupKey === 'footprint'/);
  assert.match(modalSource, /LABELS\.showSummary/);
  assert.match(modalSource, /LABELS\.maxLevels/);
  assert.match(modalSource, /LABELS\.priceStep/);
  assert.match(overlaySource, /'footprint'/);
});
