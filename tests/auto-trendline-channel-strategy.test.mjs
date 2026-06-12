import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  calculateAutoTrendlineChannel,
  simulateAutoTrendlineChannelStrategy,
} from '../src/strategy/strategies/auto-trendline-channel-runtime.ts';
import { autoTrendlineChannelJs } from '../src/strategy/strategies/auto-trendline-channel-js.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const rendererSource = fs.readFileSync(new URL('../src/chart/renderers/auto-trendline-channel-renderer.ts', import.meta.url), 'utf8');

test('auto trendline channel calculates parallel channel series and trend states', () => {
  const candles = Array.from({ length: 48 }, (_, index) => {
    const close = index < 28 ? 100 + index * 0.9 : 126 - (index - 28) * 1.1;
    return {
      open: close - 0.4,
      high: close + 1,
      low: close - 1,
      close,
    };
  });

  const result = calculateAutoTrendlineChannel(candles, { channelLength: 6, widthMultiplier: 1.2 });

  assert.equal(result.upper.length, candles.length);
  assert.equal(result.basis.length, candles.length);
  assert.equal(result.lower.length, candles.length);
  assert.equal(result.trend.length, candles.length);
  assert(result.upper.some((value, index) => value != null && result.basis[index] != null && result.lower[index] != null));
  assert(result.trend.includes('bullish'));
  assert(result.trend.includes('bearish'));
  result.upper.forEach((upper, index) => {
    const basis = result.basis[index];
    const lower = result.lower[index];
    if (upper == null || basis == null || lower == null) return;
    assert(upper > basis);
    assert(basis > lower);
    assert(Math.abs((upper - basis) - (basis - lower)) < 1e-8);
  });
});

test('auto trendline channel strategy emits entry signals and caches runtime metadata', () => {
  const close = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    105, 108, 112, 115, 118, 121, 124, 127, 130, 128, 126, 124,
    122, 120, 118, 116, 114, 112, 110,
  ];
  const candles = close.map((value) => ({
    open: value - 0.3,
    high: value + 1,
    low: value - 1,
    close: value,
  }));

  const result = simulateAutoTrendlineChannelStrategy(candles, {
    channelLength: 5,
    widthMultiplier: 0.8,
    rrRatio: 1.5,
    useLong: true,
    useShort: true,
  });

  assert(result.signals.some((signal) => signal === 1));
  assert(result.signals.some((signal) => signal === -1));
  assert.equal(result.channel.upper.length, close.length);

  const strategyFn = vm.runInNewContext(autoTrendlineChannelJs.sourceCode, {});
  const context = {
    open: candles.map((candle) => candle.open),
    high: candles.map((candle) => candle.high),
    low: candles.map((candle) => candle.low),
    close: candles.map((candle) => candle.close),
    __strategyParams: {
      channelLength: 5,
      widthMultiplier: 0.8,
      rrRatio: 1.5,
      useLong: true,
      useShort: true,
    },
  };
  const signals = close.map((_, index) => strategyFn(context, index));

  assert(signals.every((signal) => [-1, 0, 1].includes(signal)));
  assert.deepEqual(signals, result.signals);
  assert(context.__autoTrendlineChannelCache);
});

test('auto trendline channel strategy is registered and wired to chart renderer', () => {
  assert.equal(autoTrendlineChannelJs.id, 'strategy_js_auto_trendline_channel');
  assert.match(strategyIndexSource, /autoTrendlineChannelJs/);
  assert.match(simpleChartSource, /AUTO_TRENDLINE_CHANNEL_STRATEGY_ID = 'strategy_js_auto_trendline_channel'/);
  assert.match(simpleChartSource, /renderAutoTrendlineChannel/);
  assert.match(simpleChartSource, /calculateAutoTrendlineChannel/);
  assert.match(rendererSource, /export function renderAutoTrendlineChannel/);
  assert.match(rendererSource, /trend\[globalIndex\]/);
});
