import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { mlCvdUltimateScalperJs } from '../src/strategy/strategies/ml-cvd-ultimate-scalper-js.ts';
import { getStrategyMinimumHistory } from '../src/strategy/strategy-history.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const signalPanelSource = fs.readFileSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url), 'utf8');
const strategyServiceSource = fs.readFileSync(new URL('../src/strategy/strategy-service.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

test('ml cvd ultimate scalper strategy is registered in catalogs', () => {
  assert.equal(mlCvdUltimateScalperJs.id, 'strategy_js_ml_cvd_ultimate_scalper');
  assert.match(strategyIndexSource, /mlCvdUltimateScalperJs/);
  assert.match(signalPanelSource, /strategy_js_ml_cvd_ultimate_scalper/);
  assert.match(strategyServiceSource, /strategy_js_ml_cvd_ultimate_scalper/);
  assert.equal(getStrategyMinimumHistory('strategy_js_ml_cvd_ultimate_scalper'), 240);
});

test('strategy contexts expose the existing CVD indicator series', () => {
  assert.match(simpleChartSource, /cvd:\s*this\.calcCVD\(\)/);
  assert.match(simpleChartSource, /const cvd = Array\.isArray\(payload\.cvd\) \? payload\.cvd : \[\]/);
  assert.match(simpleChartSource, /cvd,\s*\n\s*__doubleBreakConfig/);
});

test('ml cvd ultimate scalper emits buy and sell signals from KNN, trend, ATR, and CVD filters', () => {
  const strategyFn = vm.runInNewContext(mlCvdUltimateScalperJs.sourceCode, {});
  const close = [
    100, 101, 102, 103, 104, 105,
    101, 103, 105, 107, 109, 111,
    108, 106, 104, 102, 100, 98,
    101, 103, 105, 107, 109, 111,
    108, 106, 104, 102, 100, 98,
    101, 103, 105, 107, 109, 112,
    108, 106, 104, 102, 100, 97,
  ];
  const context = {
    open: close.map((value, index) => value - (index % 2 === 0 ? 1 : -1)),
    high: close.map((value) => value + 2),
    low: close.map((value) => value - 2),
    close,
    volume: close.map(() => 1000),
    cvd: close.map((_, index) => index < 36 ? index * 10 : 360 - (index - 35) * 25),
    __strategyParams: {
      neighborsCount: 3,
      voteThreshold: 2,
      featureWindow: 6,
      trendEma: 3,
      atrPeriod: 3,
      atrRangeMult: 0.1,
      useCvdFilter: true,
    },
  };

  const signals = close.map((_, index) => strategyFn(context, index));
  assert(signals.includes(1));
  assert(signals.includes(-1));
  assert(signals.every((signal) => [-1, 0, 1].includes(signal)));
});
