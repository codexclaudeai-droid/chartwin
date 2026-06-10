import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indicatorSource = readFileSync(new URL('../src/chart/indicators/fixed-range-volume-profile.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/chart/renderers/fixed-range-volume-profile-renderer.ts', import.meta.url), 'utf8');
const chartSource = readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../src/catalog/indicators.ts', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const overlaySource = readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const panelModuleSource = readFileSync(new URL('../src/indicator-panel-module.ts', import.meta.url), 'utf8');

test('fixed range volume profile is registered and configurable', () => {
  assert.match(catalogSource, /id: 'fixedRangeVolumeProfile'[\s\S]*panel: 'main'/);
  assert.match(chartSource, /fixedRangeVolumeProfile:\s*\{[\s\S]*rowSize:\s*50[\s\S]*widthPct:\s*30/);
  assert.match(chartSource, /setFixedRangeVolumeProfileToVisibleRange\(\): boolean/);
  assert.match(modalSource, /popupKey === 'fixedRangeVolumeProfile'/);
  assert.match(modalSource, /현재 화면을 고정 범위로 지정/);
  assert.match(overlaySource, /'fixedRangeVolumeProfile'/);
  assert.match(panelModuleSource, /fixedRangeVolumeProfilePoc/);
});

test('fixed range profile uses footprint bid ask levels before OHLCV fallback', () => {
  assert.match(indicatorSource, /hasUsableFootprint/);
  assert.match(indicatorSource, /candle\.footprint\.forEach/);
  assert.match(indicatorSource, /source: 'footprint'/);
  assert.match(indicatorSource, /distributeOhlcvCandle/);
  assert.match(indicatorSource, /footprintRatio/);
  assert.match(rendererSource, /buildFixedRangeVolumeProfile/);
  assert.match(rendererSource, /FP \$\{Math\.round\(profile\.footprintRatio \* 100\)\}%/);
});

test('main background layer renders fixed range profile from full candle data', () => {
  const backgroundSource = readFileSync(new URL('../src/chart/renderers/main-background-layer-orchestrator.ts', import.meta.url), 'utf8');
  assert.match(backgroundSource, /renderFixedRangeVolumeProfile/);
  assert.match(backgroundSource, /allCandles/);
  assert.match(chartSource, /allCandles:\s*this\.data/);
  assert.match(backgroundSource, /showLine\('fixedRangeVolumeProfilePoc'\)/);
});
