import test from 'node:test';
import assert from 'node:assert/strict';

import { hitTestDrawing } from '../src/chart/drawings/drawing-hit-test.ts';

const metrics = {
  chartLeft: 0,
  chartRight: 100,
  totalSp: 1,
  candleW: 1,
  getY: (price) => price,
};

const adapters = {
  xForIndex: (index) => index,
  getTrendlineRenderLine: (shape) => ({
    anchorStartX: shape.a.index,
    anchorStartY: shape.a.price,
    anchorEndX: shape.b.index,
    anchorEndY: shape.b.price,
    lineStartX: 0,
    lineStartY: 0,
    lineEndX: 100,
    lineEndY: 100,
  }),
  getTrendlineTextLayout: () => ({ text: '', x: 0, y: 0, width: 0, height: 0, angle: 0, isPlaceholder: false }),
  getAnchoredVwapPlot: () => [],
  isCoarsePointer: () => false,
};

test('extended trendline does not treat the whole rendered bounding box as body hit area', () => {
  const part = hitTestDrawing({
    shape: {
      id: 'shape-1',
      kind: 'extended-trendline',
      a: { index: 20, price: 20 },
      b: { index: 40, price: 40 },
    },
    mx: 90,
    my: 20,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  });

  assert.equal(part, null);
});

test('extended trendline does not treat the anchor-to-anchor box as a hoverable body area', () => {
  const part = hitTestDrawing({
    shape: {
      id: 'shape-1b',
      kind: 'extended-trendline',
      a: { index: 20, price: 20 },
      b: { index: 40, price: 40 },
    },
    mx: 24,
    my: 56,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  });

  assert.equal(part, null);
});

test('ray trendline still responds when the pointer is actually on the visible extended line', () => {
  const part = hitTestDrawing({
    shape: {
      id: 'shape-2',
      kind: 'ray-trendline',
      a: { index: 20, price: 20 },
      b: { index: 40, price: 40 },
    },
    mx: 80,
    my: 80,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  });

  assert.equal(part, 'line');
});
