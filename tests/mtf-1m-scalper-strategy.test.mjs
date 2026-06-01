import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { mtf1mScalperJs } from '../src/strategy/strategies/mtf-1m-scalper-js.ts';
import { getStrategyMinimumHistory } from '../src/strategy/strategy-history.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const signalPanelSource = fs.readFileSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url), 'utf8');
const strategyServiceSource = fs.readFileSync(new URL('../src/strategy/strategy-service.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

test('mtf 1m scalper strategy is registered in strategy and signal admin catalogs', () => {
  assert.equal(mtf1mScalperJs.id, 'strategy_js_mtf_1m_scalper');
  assert.match(strategyIndexSource, /mtf1mScalperJs/);
  assert.match(signalPanelSource, /strategy_js_mtf_1m_scalper/);
  assert.match(strategyServiceSource, /strategy_js_mtf_1m_scalper/);
  assert.equal(getStrategyMinimumHistory('strategy_js_mtf_1m_scalper'), 260);
});

test('mtf 1m scalper is wired to strategy SL/TP risk lines and report output', () => {
  assert.match(simpleChartSource, /MTF_1M_SCALPER_STRATEGY_ID = 'strategy_js_mtf_1m_scalper'/);
  assert.match(simpleChartSource, /getMtf1mScalperRiskConfig/);
  assert.match(simpleChartSource, /buildMtf1mScalperReport/);
  assert.match(simpleChartSource, /stopLoss: candle\.close - distance/);
  assert.match(simpleChartSource, /takeProfits: \[candle\.close \+ distance \* risk\.tpMult\]/);
});

test('mtf 1m scalper emits cross signals with derived higher timeframe filter', () => {
  const strategyFn = vm.runInNewContext(mtf1mScalperJs.sourceCode, {});
  const close = [
    1, 1, 1, 1, 1,
    0.9, 0.8, 0.7,
    0.8, 0.9, 1, 1.1,
    1.2, 1.3, 1.4, 1.5,
    1.6, 1.7, 1.8, 1.9,
  ];
  const context = {
    close,
    high: close.map((value) => value + 0.05),
    low: close.map((value) => value - 0.05),
    __strategyParams: {
      fastEma: 2,
      slowEma: 4,
      filterEma: 2,
      atrPeriod: 2,
      htfFactor: 2,
    },
  };

  const signals = close.map((_, index) => strategyFn(context, index));
  assert.equal(signals[5], -1);
  assert.equal(signals[9], 1);
  assert(signals.every((signal) => [-1, 0, 1].includes(signal)));
});
