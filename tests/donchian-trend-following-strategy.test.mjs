import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  simulateDonchianTrendFollowingStrategy,
} from '../src/strategy/strategies/donchian-trend-following-runtime.ts';
import { donchianTrendFollowingJs } from '../src/strategy/strategies/donchian-trend-following-js.ts';
import { getStrategyMinimumHistory } from '../src/strategy/strategy-history.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const strategyServiceSource = fs.readFileSync(new URL('../src/strategy/strategy-service.ts', import.meta.url), 'utf8');
const signalPanelSource = fs.readFileSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');

function candle(close, index = 0) {
  return {
    time: index,
    open: close - 0.15,
    high: close + 0.25,
    low: close - 0.25,
    close,
    volume: 100,
  };
}

function ohlc({ open, high, low, close }, index = 0) {
  return {
    time: index,
    open,
    high,
    low,
    close,
    volume: 100,
  };
}

test('Donchian trend-following strategy suppresses sideways breakouts', () => {
  const sideways = Array.from({ length: 80 }, (_, index) => {
    const close = 100 + Math.sin(index / 2) * 0.8 + (index % 9 === 0 ? 0.45 : 0);
    return candle(close, index);
  });

  const result = simulateDonchianTrendFollowingStrategy(sideways, {
    entryPeriod: 10,
    exitPeriod: 5,
    atrPeriod: 5,
    emaPeriod: 8,
    trendLookback: 12,
    minEfficiency: 0.62,
    minChannelAtr: 0.8,
    rrRatio: 2,
  });

  assert.equal(result.signals.some(Boolean), false);
  assert(result.sideways.some(Boolean));
});

test('Donchian trend-following strategy emits filtered long and short breakout entries', () => {
  const uptrend = Array.from({ length: 70 }, (_, index) => {
    const close = index < 25 ? 100 + index * 0.08 : 102 + (index - 25) * 0.9;
    return candle(close, index);
  });
  const downtrend = Array.from({ length: 70 }, (_, index) => {
    const close = index < 25 ? 140 - index * 0.08 : 138 - (index - 25) * 0.9;
    return candle(close, index);
  });
  const options = {
    entryPeriod: 10,
    exitPeriod: 5,
    atrPeriod: 5,
    emaPeriod: 8,
    trendLookback: 10,
    minEfficiency: 0.45,
    minChannelAtr: 0.8,
    rrRatio: 2,
    useLong: true,
    useShort: true,
  };

  const longResult = simulateDonchianTrendFollowingStrategy(uptrend, options);
  const shortResult = simulateDonchianTrendFollowingStrategy(downtrend, options);
  const longIndex = longResult.signals.findIndex((signal) => signal === 1);
  const shortIndex = shortResult.signals.findIndex((signal) => signal === -1);

  assert(longIndex >= 0);
  assert(shortIndex >= 0);
  assert.equal(longResult.sideways[longIndex], false);
  assert.equal(shortResult.sideways[shortIndex], false);
  assert(longResult.stopLoss[longIndex] != null && longResult.stopLoss[longIndex] < uptrend[longIndex].close);
  assert(longResult.takeProfit[longIndex] != null && longResult.takeProfit[longIndex] > uptrend[longIndex].close);
  assert(shortResult.stopLoss[shortIndex] != null && shortResult.stopLoss[shortIndex] > downtrend[shortIndex].close);
  assert(shortResult.takeProfit[shortIndex] != null && shortResult.takeProfit[shortIndex] < downtrend[shortIndex].close);
});

test('Donchian pullback mode buys after upper touch, middle reversion, and middle support', () => {
  const candles = Array.from({ length: 12 }, (_, index) => candle(100 + index * 0.5, index));
  candles.push(ohlc({ open: 105.8, high: 107.4, low: 106.2, close: 107 }, 12));
  candles.push(ohlc({ open: 105.4, high: 105.8, low: 104.1, close: 104.7 }, 13));
  candles.push(ohlc({ open: 105, high: 106.1, low: 105.1, close: 105.8 }, 14));

  const result = simulateDonchianTrendFollowingStrategy(candles, {
    entryMode: 'pullback',
    entryPeriod: 6,
    exitPeriod: 3,
    atrPeriod: 3,
    emaPeriod: 3,
    trendLookback: 3,
    minEfficiency: 0,
    minChannelAtr: 0,
    middleTouchToleranceAtr: 0.2,
    setupExpireBars: 6,
    useLong: true,
    useShort: false,
  });

  assert.equal(result.signals[12], 0);
  assert.equal(result.signals[13], 0);
  assert.equal(result.signals[14], 1);
  assert(result.stopLoss[14] != null && result.stopLoss[14] < candles[14].close);
  assert(result.takeProfit[14] != null && result.takeProfit[14] > candles[14].close);
});

test('Donchian pullback mode sells after lower touch, middle reversion, and middle resistance', () => {
  const candles = Array.from({ length: 12 }, (_, index) => candle(120 - index * 0.5, index));
  candles.push(ohlc({ open: 114.4, high: 114.7, low: 112.6, close: 113 }, 12));
  candles.push(ohlc({ open: 114.9, high: 115.9, low: 114.9, close: 115.3 }, 13));
  candles.push(ohlc({ open: 114.9, high: 115.2, low: 113.9, close: 114.2 }, 14));

  const result = simulateDonchianTrendFollowingStrategy(candles, {
    entryMode: 'pullback',
    entryPeriod: 6,
    exitPeriod: 3,
    atrPeriod: 3,
    emaPeriod: 3,
    trendLookback: 3,
    minEfficiency: 0,
    minChannelAtr: 0,
    middleTouchToleranceAtr: 0.2,
    setupExpireBars: 6,
    useLong: false,
    useShort: true,
  });

  assert.equal(result.signals[12], 0);
  assert.equal(result.signals[13], 0);
  assert.equal(result.signals[14], -1);
  assert(result.stopLoss[14] != null && result.stopLoss[14] > candles[14].close);
  assert(result.takeProfit[14] != null && result.takeProfit[14] < candles[14].close);
});

test('Donchian trend-following JS wrapper matches runtime output and caches results', () => {
  const close = Array.from({ length: 64 }, (_, index) => (
    index < 24 ? 100 + index * 0.1 : 103 + (index - 24) * 0.85
  ));
  const candles = close.map((value, index) => candle(value, index));
  const params = {
    entryPeriod: 10,
    exitPeriod: 5,
    atrPeriod: 5,
    emaPeriod: 8,
    trendLookback: 10,
    minEfficiency: 0.45,
    minChannelAtr: 0.8,
    rrRatio: 2,
  };
  const expected = simulateDonchianTrendFollowingStrategy(candles, params);
  const strategyFn = vm.runInNewContext(donchianTrendFollowingJs.sourceCode, {});
  const context = {
    open: candles.map((item) => item.open),
    high: candles.map((item) => item.high),
    low: candles.map((item) => item.low),
    close: candles.map((item) => item.close),
    volume: candles.map((item) => item.volume),
    __strategyParams: params,
  };
  const actual = close.map((_, index) => strategyFn(context, index));

  assert.deepEqual(actual, expected.signals);
  assert(context.__donchianTrendFollowingCache);
});

test('Donchian trend-following strategy is registered and exposes settings', () => {
  assert.equal(donchianTrendFollowingJs.id, 'strategy_js_donchian_trend_following');
  assert.match(strategyIndexSource, /donchianTrendFollowingJs/);
  assert.match(strategyServiceSource, /strategy_js_donchian_trend_following/);
  assert.match(signalPanelSource, /strategy_js_donchian_trend_following/);
  assert.equal(getStrategyMinimumHistory('strategy_js_donchian_trend_following'), 120);
  assert.match(simpleChartSource, /DONCHIAN_TREND_FOLLOWING_STRATEGY_ID = 'strategy_js_donchian_trend_following'/);
  assert.match(simpleChartSource, /simulateDonchianTrendFollowingStrategy\(this\.data, this\.getActiveStrategy\(\)\?\.params \?\? \{\}\)/);
  assert.match(modalSource, /DONCHIAN_TREND_FOLLOWING_ID = 'strategy_js_donchian_trend_following'/);
  assert.match(modalSource, /donchianTrendBox\.style\.display = activeIsDonchianTrend \? 'block' : 'none'/);
  assert.match(modalSource, /createDonchianTrendModeSelect\('entryMode', 'Entry Mode'\)/);
  assert.match(modalSource, /middleTouchToleranceAtr/);
  assert.match(modalSource, /setupExpireBars/);
});
