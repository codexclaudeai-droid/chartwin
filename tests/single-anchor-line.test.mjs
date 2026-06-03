import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSingleAnchorLineSegments,
  isSingleAnchorLineKind,
} from '../src/ui/workspace/drawing-utils.ts';
import { hitTestDrawing } from '../src/chart/drawings/drawing-hit-test.ts';

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
