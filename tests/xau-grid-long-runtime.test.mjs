import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  buildXauGridLevels,
  resolveXauGridLongConfig,
  simulateXauGridLong,
} from '../src/strategy/strategies/xau-grid-long-runtime.ts';
import { xauGridLongJs } from '../src/strategy/strategies/xau-grid-long-js.ts';

const strategySource = fs.readFileSync(new URL('../src/strategy/strategies/xau-grid-long-js.ts', import.meta.url), 'utf8');
const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const reportPanelSource = fs.readFileSync(new URL('../src/ui/workspace/strategy-report-panel.ts', import.meta.url), 'utf8');

test('xau grid resolves defaults and supports overrides', () => {
  const defaults = resolveXauGridLongConfig({});
  assert.equal(defaults.highPrice, 4857.27);
  assert.equal(defaults.lowPrice, 3568.69);
  assert.equal(defaults.nLevels, 48);
  assert.equal(defaults.gridMode, 'geometric');
  assert.equal(defaults.investment, 2000);

  const custom = resolveXauGridLongConfig({
    highPrice: 200,
    lowPrice: 100,
    nLevels: 10,
    gridMode: 'arithmetic',
    investment: 1500,
  });
  assert.equal(custom.highPrice, 200);
  assert.equal(custom.lowPrice, 100);
  assert.equal(custom.nLevels, 10);
  assert.equal(custom.gridMode, 'arithmetic');
  assert.equal(custom.investment, 1500);
});

test('xau grid builds arithmetic and geometric levels correctly', () => {
  const arithmetic = buildXauGridLevels({
    highPrice: 200,
    lowPrice: 100,
    nLevels: 5,
    gridMode: 'arithmetic',
    investment: 300,
  });
  assert.deepEqual(arithmetic, [200, 175, 150, 125, 100]);

  const geometric = buildXauGridLevels({
    highPrice: 400,
    lowPrice: 100,
    nLevels: 5,
    gridMode: 'geometric',
    investment: 300,
  });
  assert.equal(geometric[0], 400);
  assert.equal(Math.round(geometric[2] * 1000) / 1000, 200);
  assert.equal(geometric[4], 100);
});

test('xau grid emits a buy signal when price crosses down into an empty slot', () => {
  const result = simulateXauGridLong([210, 140], {
    highPrice: 200,
    lowPrice: 100,
    nLevels: 5,
    gridMode: 'arithmetic',
    investment: 500,
  });
  assert.equal(result.signals[1], 1);
  assert.deepEqual(result.bars[1].buyLevels, [1, 2]);
  assert.equal(result.bars[1].sellLevels.length, 0);
  assert.equal(result.bars[1].ownedCount, 2);
  assert.equal(Math.round(result.bars[1].avgEntry * 100) / 100, 161.54);
});

test('xau grid emits a sell signal when price crosses above the level above an owned slot', () => {
  const result = simulateXauGridLong([210, 140, 205], {
    highPrice: 200,
    lowPrice: 100,
    nLevels: 5,
    gridMode: 'arithmetic',
    investment: 500,
  });
  assert.equal(result.signals[2], -1);
  assert.deepEqual(result.bars[2].sellLevels, [1, 2]);
  assert.equal(result.bars[2].ownedCount, 0);
  assert.equal(result.bars[2].avgEntry, null);
});

test('xau grid records multi-level crosses while collapsing chart output to one signal', () => {
  const result = simulateXauGridLong([210, 90], {
    highPrice: 200,
    lowPrice: 100,
    nLevels: 5,
    gridMode: 'arithmetic',
    investment: 500,
  });
  assert.equal(result.signals[1], 1);
  assert.deepEqual(result.bars[1].buyLevels, [1, 2, 3, 4]);
  assert.equal(result.bars[1].ownedCount, 4);
  assert.equal(result.bars[1].eventType, 'buy');
});

test('xau grid strategy wrapper embeds runtime logic and is exported in the strategy index', () => {
  assert.match(strategySource, /simulateXauGridLong/);
  assert.match(strategySource, /context\.__xauGridLongCache/);
  assert.match(strategyIndexSource, /xauGridLongJs/);

  const strategyFn = vm.runInNewContext(xauGridLongJs.sourceCode, {});
  const prices = [210, 140, 205];
  const ctx = {
    close: prices,
    __strategyParams: {
      highPrice: 200,
      lowPrice: 100,
      nLevels: 5,
      gridMode: 'arithmetic',
      investment: 500,
    },
  };
  const signals = prices.map((_, index) => strategyFn(ctx, index));
  assert.deepEqual(signals, [0, 1, -1]);
});

test('xau grid strategy modal exposes configurable range and grid fields', () => {
  assert.match(modalSource, /XAU Grid Long 설정/);
  assert.match(modalSource, /High Price/);
  assert.match(modalSource, /Low Price/);
  assert.match(modalSource, /Grid Levels/);
  assert.match(modalSource, /Spacing Mode/);
  assert.match(modalSource, /Total Investment/);
});

test('xau grid report plumbing exposes strategy metadata in chart report panel', () => {
  assert.match(simpleChartSource, /strategy_js_xau_grid_long/);
  assert.match(simpleChartSource, /simulateXauGridLong/);
  assert.match(simpleChartSource, /strategyMeta/);
  assert.match(reportPanelSource, /Owned Slots/);
  assert.match(reportPanelSource, /Avg Entry/);
  assert.match(reportPanelSource, /Buy Levels/);
  assert.match(reportPanelSource, /Sell Levels/);
});
