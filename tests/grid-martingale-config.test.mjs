import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { gridMartingaleJs } from '../src/strategy/strategies/grid-martingale-js.ts';
import {
  GRID_MARTINGALE_PRESETS,
  inferGridMartingalePreset,
  resolveGridMartingaleConfig,
} from '../src/strategy/strategies/grid-martingale-presets.js';

const strategySource = fs.readFileSync(new URL('../src/strategy/strategies/grid-martingale-js.ts', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../src/strategy/strategies/grid-martingale-runtime.js', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');

test('grid martingale infers NASDAQ and GOLD presets from symbol', () => {
  assert.equal(inferGridMartingalePreset('NQ1!'), 'NASDAQ');
  assert.equal(inferGridMartingalePreset('NAS100'), 'NASDAQ');
  assert.equal(inferGridMartingalePreset('XAUUSD'), 'GOLD');
  assert.equal(inferGridMartingalePreset('BTCUSDT'), 'DEFAULT');
});

test('grid martingale resolves symbol defaults and allows overrides', () => {
  const nasdaq = resolveGridMartingaleConfig('NQ1!', {});
  assert.deepEqual(nasdaq, GRID_MARTINGALE_PRESETS.NASDAQ);

  const gold = resolveGridMartingaleConfig('XAUUSD', { gridStep: 30, maxLevel: 9 });
  assert.equal(gold.gridStep, 30);
  assert.equal(gold.maxLevel, 9);
  assert.equal(gold.takeProfitSteps, GRID_MARTINGALE_PRESETS.GOLD.takeProfitSteps);
});

test('grid martingale strategy source uses shared runtime config helper', () => {
  assert.match(strategySource, /resolveGridMartingaleConfig/);
  assert.match(strategySource, /takeProfitSteps/);
  assert.match(strategySource, /equityStopPct/);
});

test('grid martingale sourceCode executes standalone with embedded config logic', () => {
  const strategyFn = vm.runInNewContext(gridMartingaleJs.sourceCode, {});
  const ctx = {
    close: [100, 100, 100, 100],
    __symbol: 'NQ1!',
    __strategyParams: { gridStep: 40, takeProfitSteps: 1.8, maxLevel: 7, equityStopPct: 12 },
  };
  assert.doesNotThrow(() => strategyFn(ctx, 1));
  assert.notEqual(strategyFn(ctx, 1), 0);
});

test('strategy modal exposes configurable grid martingale fields', () => {
  assert.match(modalSource, /Grid Martingale Scalping 설정/);
  assert.match(modalSource, /TP Step/);
  assert.match(modalSource, /Max Level/);
  assert.match(modalSource, /Stop Loss %/);
});

test('grid martingale source implements independent long and short baskets', () => {
  assert.match(runtimeSource, /longBasket/);
  assert.match(runtimeSource, /shortBasket/);
  assert.match(runtimeSource, /shortOpenPnl/);
  assert.match(runtimeSource, /price >= worstShortEntry \+ gridStep/);
});

test('grid martingale can emit both buy and sell entries in a standalone worker context', () => {
  const strategyFn = vm.runInNewContext(gridMartingaleJs.sourceCode, {});
  const prices = [100, 100, 100.5, 101, 101.5, 101.1, 100.7, 100.2, 99.8, 100.4, 101.2];
  const ctx = {
    close: prices,
    __symbol: 'NQ1!',
    __strategyParams: { gridStep: 2, takeProfitSteps: 1, maxLevel: 4, equityStopPct: 50 },
  };
  const signals = prices.map((_, index) => strategyFn(ctx, index));
  assert.ok(signals.some((value) => value > 0));
  assert.ok(signals.some((value) => value < 0));
});
