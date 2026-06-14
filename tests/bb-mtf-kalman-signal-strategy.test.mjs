import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { calculateBbMtfKalmanSignal } from '../src/chart/indicators/index.ts';
import { bbMtfKalmanSignalJs } from '../src/strategy/strategies/bb-mtf-kalman-signal-js.ts';
import { getStrategyMinimumHistory } from '../src/strategy/strategy-history.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const signalPanelSource = fs.readFileSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url), 'utf8');
const strategyServiceSource = fs.readFileSync(new URL('../src/strategy/strategy-service.ts', import.meta.url), 'utf8');

function candle(open, high, low, close, volume = 100, time = 0) {
  return { open, high, low, close, volume, time };
}

test('BB MTF Kalman Signal strategy is registered in strategy and admin catalogs', () => {
  assert.equal(bbMtfKalmanSignalJs.id, 'strategy_js_bb_mtf_kalman_signal');
  assert.match(strategyIndexSource, /bbMtfKalmanSignalJs/);
  assert.match(signalPanelSource, /strategy_js_bb_mtf_kalman_signal/);
  assert.match(strategyServiceSource, /strategy_js_bb_mtf_kalman_signal/);
  assert.equal(getStrategyMinimumHistory('strategy_js_bb_mtf_kalman_signal'), 240);
});

test('BB MTF Kalman Signal strategy emits indicator buy and sell signals', () => {
  const closes = [
    100, 100, 100, 100,
    100, 100, 100, 100,
    100, 100, 100, 100,
    114, 116, 118, 120,
    119, 118, 117, 116,
    115, 114, 113, 112,
  ];
  const candles = closes.map((close, index) => candle(close - 0.4, close + 1, close - 1, close, 100, index * 3600));
  const params = {
    chartTimeframe: '1h',
    htfTimeframe: '4h',
    ltfLength: 3,
    ltfMult: 1,
    htfLength: 3,
    htfMult: 1,
  };

  const expected = calculateBbMtfKalmanSignal(candles, params);
  const strategyFn = vm.runInNewContext(bbMtfKalmanSignalJs.sourceCode, {});
  const context = {
    open: candles.map((item) => item.open),
    high: candles.map((item) => item.high),
    low: candles.map((item) => item.low),
    close: candles.map((item) => item.close),
    volume: candles.map((item) => item.volume),
    time: candles.map((item) => item.time),
    __strategyParams: params,
  };

  const signals = closes.map((_, index) => strategyFn(context, index));

  assert.deepEqual(signals, expected.sellSignal.map((sell, index) => {
    if (expected.buySignal[index]) return 1;
    if (sell) return -1;
    return 0;
  }));
  assert(signals.some((signal) => signal === -1));
  assert(signals.every((signal) => [-1, 0, 1].includes(signal)));
});
