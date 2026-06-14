import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSingleAnchorLineSegments,
  isSingleAnchorLineKind,
} from '../src/ui/workspace/drawing-utils.ts';
import { hitTestDrawing } from '../src/chart/drawings/drawing-hit-test.ts';
import { renderSingleAnchorLine } from '../src/chart/drawings/drawing-single-anchor-line-renderer.ts';

test('recognizes single-anchor infinite line drawing kinds', () => {
  assert.equal(isSingleAnchorLineKind('vertical-line'), true);
  assert.equal(isSingleAnchorLineKind('cross-line'), true);
  assert.equal(isSingleAnchorLineKind('trendline'), false);
});

test('builds a full-height segment for vertical lines', () => {
  const segments = getSingleAnchorLineSegments(
    { x: 40, y: 55 },
    { left: 0, right: 100, top: 0, bottom: 100 },
    'vertical-line',
  );
  assert.deepEqual(segments, [
    { x1: 40, y1: 0, x2: 40, y2: 100 },
  ]);
});

test('builds full crosshair segments for cross lines', () => {
  const segments = getSingleAnchorLineSegments(
    { x: 40, y: 55 },
    { left: 0, right: 100, top: 0, bottom: 100 },
    'cross-line',
  );
  assert.deepEqual(segments, [
    { x1: 40, y1: 0, x2: 40, y2: 100 },
    { x1: 0, y1: 55, x2: 100, y2: 55 },
  ]);
});

const metrics = {
  chartLeft: 0,
  chartRight: 100,
  chartTop: 0,
  chartBottom: 100,
  totalSp: 1,
  candleW: 1,
  getY: (price) => price,
};

const adapters = {
  xForIndex: (index) => index,
  getTrendlineRenderLine: () => ({
    anchorStartX: 0,
    anchorStartY: 0,
    anchorEndX: 0,
    anchorEndY: 0,
    lineStartX: 0,
    lineStartY: 0,
    lineEndX: 0,
    lineEndY: 0,
  }),
  getTrendlineTextLayout: () => ({ text: '', x: 0, y: 0, width: 0, height: 0, angle: 0, isPlaceholder: false }),
  getAnchoredVwapPlot: () => [],
  isCoarsePointer: () => false,
};

test('vertical line hits only the visible line or anchor', () => {
  const shape = {
    id: 'vertical-shape',
    kind: 'vertical-line',
    a: { index: 40, price: 55 },
  };

  assert.equal(hitTestDrawing({
    shape,
    mx: 40,
    my: 20,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'line');

  assert.equal(hitTestDrawing({
    shape,
    mx: 62,
    my: 20,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), null);

  assert.equal(hitTestDrawing({
    shape,
    mx: 40,
    my: 55,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'start');
});

test('cross line responds on both visible axes and not on empty quadrants', () => {
  const shape = {
    id: 'cross-shape',
    kind: 'cross-line',
    a: { index: 40, price: 55 },
  };

  assert.equal(hitTestDrawing({
    shape,
    mx: 40,
    my: 12,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'line');

  assert.equal(hitTestDrawing({
    shape,
    mx: 12,
    my: 55,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'line');

  assert.equal(hitTestDrawing({
    shape,
    mx: 12,
    my: 12,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), null);
});

function createRecordingContext() {
  const calls = [];
  let fillStyle = '';
  const ctx = {
    calls,
    strokeStyle: '',
    get fillStyle() { return fillStyle; },
    set fillStyle(value) {
      fillStyle = value;
      calls.push(['fillStyle', value]);
    },
    lineWidth: 0,
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x, y) => calls.push(['moveTo', x, y]),
    lineTo: (x, y) => calls.push(['lineTo', x, y]),
    closePath: () => calls.push(['closePath']),
    stroke: () => calls.push(['stroke']),
    fill: () => calls.push(['fill']),
    fillRect: (x, y, w, h) => calls.push(['fillRect', x, y, w, h]),
    rect: (x, y, w, h) => calls.push(['rect', x, y, w, h]),
    roundRect: (x, y, w, h, r) => calls.push(['roundRect', x, y, w, h, r]),
    arc: (x, y, r, s, e) => calls.push(['arc', x, y, r, s, e]),
    setLineDash: (dash) => calls.push(['setLineDash', dash]),
    fillText: (text, x, y) => calls.push(['fillText', text, x, y]),
    measureText: (text) => ({ width: String(text).length * 6 }),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
  };
  return ctx;
}

test('vertical and cross lines render through sub-indicator panels with axis price and timeline labels', () => {
  const ctx = createRecordingContext();

  renderSingleAnchorLine({
    ctx,
    shape: {
      id: 'vertical-shape',
      kind: 'vertical-line',
      a: { index: 40, price: 55 },
    },
    isDraft: false,
    metrics: {
      ...metrics,
      axisPad: 60,
      axisSide: 'right',
      axisLeft: 100,
      plotBottom: 180,
    },
    alpha: 1,
    strokeColor: '#2f6cff',
    strokeWidth: 2,
    lineStyle: 'solid',
    selectedDrawingId: null,
    hoveredDrawingId: null,
    fontStack: 'Arial',
    formatPrice: (value) => value.toFixed(2),
    candles: Array.from({ length: 80 }, (_, index) => ({ time: 1713916800 + index * 60 })),
    timezone: 'UTC+9',
    timeframe: '1m',
    xAxisHeight: 24,
    viewportHeight: 204,
    xForIndex: (index) => index,
  });

  assert.ok(ctx.calls.some((call) => call[0] === 'lineTo' && call[1] === 40 && call[2] === 180));
  assert.ok(ctx.calls.some((call) => call[0] === 'fillText' && call[1] === '55.00'));
  assert.ok(ctx.calls.some((call) => call[0] === 'fillText' && /09:40/.test(String(call[1]))));
  assert.ok(ctx.calls.some((call, index) => (
    call[0] === 'fillRect'
    && ctx.calls[index - 1]?.[0] === 'fillStyle'
    && ctx.calls[index - 1]?.[1] === '#2f6cff'
  )));

  const crossCtx = createRecordingContext();
  renderSingleAnchorLine({
    ctx: crossCtx,
    shape: {
      id: 'cross-shape',
      kind: 'cross-line',
      a: { index: 40, price: 55 },
    },
    isDraft: false,
    metrics: {
      ...metrics,
      axisPad: 60,
      axisSide: 'right',
      axisLeft: 100,
      plotBottom: 180,
    },
    alpha: 1,
    strokeColor: '#2f6cff',
    strokeWidth: 2,
    lineStyle: 'solid',
    selectedDrawingId: null,
    hoveredDrawingId: null,
    fontStack: 'Arial',
    formatPrice: (value) => value.toFixed(2),
    candles: Array.from({ length: 80 }, (_, index) => ({ time: 1713916800 + index * 60 })),
    timezone: 'UTC+9',
    timeframe: '1m',
    xAxisHeight: 24,
    viewportHeight: 204,
    xForIndex: (index) => index,
  });

  assert.ok(crossCtx.calls.some((call) => call[0] === 'lineTo' && call[1] === 40 && call[2] === 180));
  assert.ok(crossCtx.calls.some((call) => call[0] === 'lineTo' && call[1] === 100 && call[2] === 55));
  assert.ok(crossCtx.calls.some((call) => call[0] === 'fillText' && call[1] === '55.00'));
  assert.ok(crossCtx.calls.some((call) => call[0] === 'fillText' && /09:40/.test(String(call[1]))));
  assert.ok(crossCtx.calls.some((call, index) => (
    call[0] === 'fillRect'
    && crossCtx.calls[index - 1]?.[0] === 'fillStyle'
    && crossCtx.calls[index - 1]?.[1] === '#2f6cff'
  )));
});
