import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStatisticalTrailingStopMarkerGeometry,
  getStatisticalTrailingStopPanelLabelText,
  splitStatisticalTrailingStopLines,
} from '../src/chart/renderers/statistical-trailing-stop-renderer.ts';
import { renderBollingerBandFills } from '../src/chart/renderers/bollinger-renderer.ts';
import { renderEnvelopeLines } from '../src/chart/renderers/envelope-renderer.ts';
import { renderIchimoku } from '../src/chart/renderers/ichimoku-renderer.ts';
import { splitSupertrendLines } from '../src/chart/renderers/supertrend-renderer.ts';
import {
  buildVpvrProfile,
  calculateVpvrLayout,
  calculateVpvrValueArea,
} from '../src/chart/indicators/vpvr.ts';
import {
  getVpvrDashPattern,
} from '../src/chart/renderers/vpvr-renderer.ts';
import { renderVolumeProfileBackground } from '../src/chart/renderers/volume-profile-renderer.ts';
import { getWilliamsFractalMarkerGeometry } from '../src/chart/renderers/williams-fractal-renderer.ts';
import { applyBbMtfKalmanLinewidth } from '../src/chart/renderers/bb-mtf-kalman-signal-renderer.ts';

test('Williams Fractal marker geometry scales with candle width and clamps size', () => {
  assert.deepEqual(getWilliamsFractalMarkerGeometry(8), { markerSize: 5, markerOffset: 8 });
  assert.deepEqual(getWilliamsFractalMarkerGeometry(40), { markerSize: 10, markerOffset: 13 });
});

test('Supertrend renderer splits line values by direction', () => {
  const result = splitSupertrendLines({
    line: [null, 10, 11, 12],
    direction: [1, -1, 1, -1],
  }, 4);

  assert.deepEqual(result.upLine, [null, 10, null, 12]);
  assert.deepEqual(result.downLine, [null, null, 11, null]);
});

test('Statistical Trailing Stop renderer splits line values by bias', () => {
  const result = splitStatisticalTrailingStopLines({
    level: [null, 10, 11, 12],
    bias: [null, 1, 0, 1],
  }, 4);

  assert.deepEqual(result.bullLine, [null, 10, null, 12]);
  assert.deepEqual(result.bearLine, [null, null, 11, null]);
});

test('Statistical Trailing Stop marker helpers calculate size and label text', () => {
  assert.deepEqual(getStatisticalTrailingStopMarkerGeometry(1), { markerSize: 6, markerOffset: 10 });
  assert.deepEqual(getStatisticalTrailingStopMarkerGeometry(3), { markerSize: 12, markerOffset: 20 });
  assert.deepEqual(getStatisticalTrailingStopMarkerGeometry(3, true), { markerSize: 3, markerOffset: 5 });

  const label = getStatisticalTrailingStopPanelLabelText({
    level: [90],
    anchor: [100],
    extreme: [80],
  }, 0, 0);

  assert.equal(label, '10.00\n50.00%');
});

test('Envelope renderer draws visible upper, middle, and lower lines', () => {
  const calls = [];
  const style = (color, width = 1, dash = []) => ({ color, width, dash });

  renderEnvelopeLines({
    data: {
      upper: [null, 11, 12],
      mid: [null, 10, 11],
      lower: [null, 9, 10],
    },
    showLine: () => true,
    upperStyle: style('gold', 2),
    middleStyle: style('amber', 1, [4, 4]),
    lowerStyle: style('goldenrod', 2),
    drawLine: (...args) => calls.push(args),
  });

  assert.deepEqual(calls, [
    [[null, 11, 12], 'gold', 2, []],
    [[null, 10, 11], 'amber', 1, [4, 4]],
    [[null, 9, 10], 'goldenrod', 2, []],
  ]);
});

test('Ichimoku renderer draws cloud fills and offset chikou line', () => {
  const fillRects = [];
  const lines = [];
  const ctx = {
    save() {},
    restore() {},
    set fillStyle(value) {
      this._fillStyle = value;
    },
    get fillStyle() {
      return this._fillStyle;
    },
    fillRect(x, y, width, height) {
      fillRects.push([this.fillStyle, x, y, width, height]);
    },
  };
  const style = (color, width = 1, dash = []) => ({ color, width, dash });

  renderIchimoku({
    ctx,
    data: {
      tenkanLine: [null, 10, 11],
      kijunLine: [null, 9, 10],
      senkouA: [null, 12, 8],
      senkouB: [null, 10, 9],
      chikouSpan: [7, 8, 9],
    },
    enabled: true,
    startIndex: 0,
    visLength: 3,
    effectiveChartLeft: 100,
    totalSp: 10,
    tenkanStyle: style('red'),
    kijunStyle: style('blue'),
    senkouAStyle: style('green', 1, [4, 4]),
    senkouBStyle: style('maroon', 1, [4, 4]),
    chikouStyle: style('lime'),
    showLine: () => true,
    drawLine: (...args) => lines.push(args),
    getY: (price) => 100 - price,
    kijunOffset: 2,
  });

  assert.deepEqual(fillRects, [
    ['rgba(34,171,148,0.1)', 110, 88, 10, 2],
    ['rgba(242,54,69,0.1)', 120, 91, 10, 1],
  ]);
  assert.equal(lines.length, 5);
  assert.deepEqual(lines.at(-1), [[7, 8, 9], 'lime', 1, [], -2]);
});

test('Bollinger renderer draws only visible band fills', () => {
  const ops = [];
  const ctx = {
    save() { ops.push(['save']); },
    restore() { ops.push(['restore']); },
    beginPath() { ops.push(['beginPath']); },
    moveTo(x, y) { ops.push(['moveTo', x, y]); },
    lineTo(x, y) { ops.push(['lineTo', x, y]); },
    closePath() { ops.push(['closePath']); },
    fill() { ops.push(['fill', this.fillStyle]); },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
  };

  renderBollingerBandFills({
    ctx,
    bbSeries: [
      { id: 'bb1', data: { upper: [11, 12], middle: [10, 11], lower: [9, 10] } },
      { id: 'bb2', data: { upper: [21, 22], middle: [20, 21], lower: [19, 20] } },
    ],
    startIndex: 0,
    visLength: 2,
    effectiveChartLeft: 100,
    totalSp: 10,
    candleW: 4,
    showLine: (key) => key !== 'bb2Lower',
    getY: (price) => 100 - price,
  });

  assert.deepEqual(ops.filter((op) => op[0] === 'fill'), [['fill', 'rgba(100,100,255,0.05)']]);
  assert.deepEqual(ops.filter((op) => op[0] === 'moveTo'), [['moveTo', 102, 89]]);
  assert.deepEqual(ops.filter((op) => op[0] === 'lineTo'), [
    ['lineTo', 112, 88],
    ['lineTo', 112, 90],
    ['lineTo', 102, 91],
  ]);
});

test('BB MTF Kalman renderer applies grouped TradingView linewidth settings', () => {
  const style = { color: '#fff', width: 1, dash: [4, 2] };

  assert.deepEqual(applyBbMtfKalmanLinewidth(style, 3), { color: '#fff', width: 3, dash: [4, 2] });
  assert.deepEqual(applyBbMtfKalmanLinewidth(style, 0), { color: '#fff', width: 1, dash: [4, 2] });
});

test('Volume Profile renderer buckets visible candles and draws POC', () => {
  const fills = [];
  const strokes = [];
  const clips = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect(...args) { clips.push(args); },
    clip() {},
    fillRect(x, y, width, height) { fills.push([this.fillStyle, x, y, width, height]); },
    moveTo(x, y) { this._moveTo = [x, y]; },
    lineTo(x, y) { this._lineTo = [x, y]; },
    stroke() { strokes.push([this.strokeStyle, this.lineWidth, this._dash, this._moveTo, this._lineTo]); },
    setLineDash(dash) { this._dash = dash; },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
  };

  renderVolumeProfileBackground({
    ctx,
    enabled: true,
    candles: [
      { open: 10, high: 12, low: 10, close: 12, volume: 100 },
      { open: 12, high: 14, low: 12, close: 11, volume: 60 },
    ],
    rows: 2,
    minPrice: 10,
    maxPrice: 14,
    chartLeft: 50,
    chartRight: 150,
    chartWidth: 100,
    plotTop: 0,
    plotBottom: 100,
    widthRatio: 0.2,
    upFillColor: 'up',
    downFillColor: 'down',
    pocStrokeColor: 'poc',
    pocStyle: { color: 'poc', width: 2, dash: [4, 3] },
    showUp: true,
    showDown: true,
    showPoc: true,
    getY: (price) => 140 - price * 10,
  });

  assert.deepEqual(clips, [[50, 0, 100, 100]]);
  assert.deepEqual(fills, [
    ['up', 140.9090909090909, 20, 9.09090909090909, 19],
    ['down', 130, 0, 10.909090909090908, 19],
    ['up', 140.9090909090909, 0, 9.090909090909092, 19],
  ]);
  assert.deepEqual(strokes, [['poc', 2, [4, 3], [130, 10], [150, 10]]]);
});

test('VPVR renderer maps line styles to dash patterns', () => {
  assert.deepEqual(getVpvrDashPattern('dotted'), [2, 3]);
  assert.deepEqual(getVpvrDashPattern('dashed'), [6, 4]);
  assert.deepEqual(getVpvrDashPattern('solid'), []);
});

test('VPVR helpers calculate layout, profile buckets, and value area', () => {
  const layout = calculateVpvrLayout({
    vp: { rowsLayout: 'number_of_rows', rowSize: 2, widthPct: 20, valueAreaVolume: 70 },
    minPrice: 10,
    maxPrice: 14,
    chartLeft: 50,
    chartRight: 150,
    chartWidth: 100,
    symbolPriceDigits: 2,
  });

  assert.equal(layout.rows, 2);
  assert.equal(layout.effectiveBucketSpan, 2);
  assert.equal(layout.regionStart, 130);
  assert.equal(layout.regionEnd, 150);

  const profile = buildVpvrProfile({
    candles: [
      { open: 10, high: 12, low: 10, close: 12, volume: 100 },
      { open: 12, high: 14, low: 12, close: 11, volume: 60 },
    ],
    rows: layout.rows,
    minPrice: 10,
    maxPrice: 14,
    bucketSpan: layout.effectiveBucketSpan,
  });

  assert.deepEqual(profile, [
    { up: 50, down: 0, total: 50, delta: 50 },
    { up: 50, down: 60, total: 110, delta: -10 },
  ]);
  assert.deepEqual(calculateVpvrValueArea(profile, 70), { pocIndex: 1, vaLow: 0, vaHigh: 1 });
});
