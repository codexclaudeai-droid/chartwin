import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  calculateAutoTrendlineChannel,
  simulateAutoTrendlineChannelStrategy,
} from '../src/strategy/strategies/auto-trendline-channel-runtime.ts';
import { autoTrendlineChannelJs } from '../src/strategy/strategies/auto-trendline-channel-js.ts';
import { renderAutoTrendlineChannel } from '../src/chart/renderers/auto-trendline-channel-renderer.ts';
import { INDICATOR_CATALOG } from '../src/catalog/indicators.ts';
import { INDICATOR_STYLE_TARGETS } from '../src/indicator-panel-module.ts';

const strategyIndexSource = fs.readFileSync(new URL('../src/strategy/strategies/index.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const mainIndicatorSource = fs.readFileSync(new URL('../src/chart/renderers/main-indicator-orchestrator.ts', import.meta.url), 'utf8');
const rendererSource = fs.readFileSync(new URL('../src/chart/renderers/auto-trendline-channel-renderer.ts', import.meta.url), 'utf8');
const overlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const paneUtilsSource = fs.readFileSync(new URL('../src/ui/workspace/pane-utils.ts', import.meta.url), 'utf8');

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

test('auto trendline channel is exposed as an independent main indicator', () => {
  assert.deepEqual(
    INDICATOR_CATALOG.find((item) => item.id === 'autoTrendlineChannel'),
    {
      id: 'autoTrendlineChannel',
      label: 'Auto Trendline Channel',
      desc: 'Linear regression trend channel with standard deviation bands',
      panel: 'main',
    },
  );
  assert.deepEqual(
    INDICATOR_STYLE_TARGETS.autoTrendlineChannel.map((target) => target.key),
    ['autoTrendlineUpper', 'autoTrendlineBasis', 'autoTrendlineLower'],
  );
  assert.match(simpleChartSource, /autoTrendlineChannel:\s*\{\s*show:\s*false,\s*channelLength:\s*20,\s*widthMultiplier:\s*1\.5,\s*showFill:\s*true,\s*showBasis:\s*true\s*\}/);
  assert.match(simpleChartSource, /indicatorLayerOn\s+&&\s+ind\.autoTrendlineChannel\.show\s+\?\s+this\.calcAutoTrendlineChannel\(ind\.autoTrendlineChannel\)/);
  assert.match(simpleChartSource, /autoTrendlineChannelD,\s*\n\s*envD,/);
  assert.match(mainIndicatorSource, /autoTrendlineChannelD: AutoTrendlineChannelResult \| null/);
  assert.match(mainIndicatorSource, /renderAutoTrendlineChannel\(\{/);
  assert.match(mainIndicatorSource, /showFill: ind\.autoTrendlineChannel\.showFill !== false\s+&&\s+showLine\('autoTrendlineUpper'\)\s+&&\s+showLine\('autoTrendlineLower'\)/);
  assert.match(overlaySource, /autoTrendlineChannel: \(\) => `ATL\(\$\{Number\(i\.autoTrendlineChannel\?\.channelLength \?\? 20\)\}, \$\{Number\(i\.autoTrendlineChannel\?\.widthMultiplier \?\? 1\.5\)\}\)`/);
  assert.match(modalSource, /autoTrendlineChannel: \['channelLength', 'widthMultiplier'\]/);
  assert.match(paneUtilsSource, /autoTrendlineChannel\?: \{ show: boolean \}/);
  assert.match(paneUtilsSource, /names\.push\('ATL'\)/);
});

test('auto trendline channel renderer honors main indicator style visibility controls', () => {
  const ops = [];
  const ctx = {
    save() { ops.push(['save']); },
    restore() { ops.push(['restore']); },
    beginPath() { ops.push(['beginPath']); },
    rect(...args) { ops.push(['rect', ...args]); },
    clip() { ops.push(['clip']); },
    moveTo(x, y) { ops.push(['moveTo', x, y]); },
    lineTo(x, y) { ops.push(['lineTo', x, y]); },
    closePath() { ops.push(['closePath']); },
    fill() { ops.push(['fill', this.fillStyle]); },
    stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth, this._dash]); },
    setLineDash(dash) { this._dash = [...dash]; ops.push(['dash', [...dash]]); },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
  };

  renderAutoTrendlineChannel({
    ctx,
    data: {
      upper: [12, 13, 14],
      basis: [10, 11, 12],
      lower: [8, 9, 10],
      trend: ['bullish', 'bullish', 'bullish'],
    },
    startIndex: 0,
    visLength: 3,
    chartLeft: 50,
    chartRight: 150,
    plotTop: 0,
    plotBottom: 100,
    effectiveChartLeft: 50,
    totalSp: 10,
    candleW: 4,
    getY: (price) => 100 - price,
    showFill: false,
    showUpper: true,
    showBasis: false,
    showLower: true,
    upperStyle: { color: 'upper-style', width: 2.5, dash: [2, 2] },
    basisStyle: { color: 'basis-style', width: 1, dash: [5, 4] },
    lowerStyle: { color: 'lower-style', width: 3, dash: [] },
  });

  assert.deepEqual(ops.filter((op) => op[0] === 'fill'), []);
  assert.deepEqual(
    ops.filter((op) => op[0] === 'stroke'),
    [
      ['stroke', 'upper-style', 2.5, [2, 2]],
      ['stroke', 'lower-style', 3, []],
    ],
  );
});
