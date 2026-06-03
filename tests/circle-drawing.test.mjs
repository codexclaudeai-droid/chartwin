import test from 'node:test';
import assert from 'node:assert/strict';

import { canCopyDrawingShape, getCircleScreenGeometry } from '../src/ui/workspace/drawing-utils.ts';
import { hitTestDrawing } from '../src/chart/drawings/drawing-hit-test.ts';

test('builds ellipse geometry from center and radius anchor', () => {
  const geometry = getCircleScreenGeometry(
    { x: 40, y: 50 },
    { x: 60, y: 70 },
  );

  assert.deepEqual(geometry, {
    centerX: 40,
    centerY: 50,
    radiusX: 20,
    radiusY: 20,
  });
});

test('circle drawing is eligible for clipboard copy', () => {
  assert.equal(canCopyDrawingShape({ kind: 'draw-circle' }), true);
  assert.equal(canCopyDrawingShape({ kind: 'trendline' }), true);
  assert.equal(canCopyDrawingShape({ kind: 'measure' }), false);
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

test('circle drawing hits center, radius handle, edge, and body distinctly', () => {
  const shape = {
    id: 'circle-shape',
    kind: 'draw-circle',
    a: { index: 40, price: 50 },
    b: { index: 60, price: 70 },
  };

  assert.equal(hitTestDrawing({
    shape,
    mx: 40,
    my: 50,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'start');

  assert.equal(hitTestDrawing({
    shape,
    mx: 60,
    my: 70,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'end');

  assert.equal(hitTestDrawing({
    shape,
    mx: 60,
    my: 50,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'line');

  assert.equal(hitTestDrawing({
    shape,
    mx: 50,
    my: 50,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), 'body');

  assert.equal(hitTestDrawing({
    shape,
    mx: 70,
    my: 50,
    metrics,
    hoveredDrawingId: null,
    hoveredDrawingPart: null,
    adapters,
  }), null);
});

test('circle drawing exposes a text guide hit near its center when hovered', () => {
  const shape = {
    id: 'circle-shape-text',
    kind: 'draw-circle',
    a: { index: 40, price: 50 },
    b: { index: 60, price: 70 },
  };

  const part = hitTestDrawing({
    shape,
    mx: 40,
    my: 36,
    metrics,
    hoveredDrawingId: 'circle-shape-text',
    hoveredDrawingPart: 'line',
    adapters: {
      ...adapters,
      getTrendlineTextLayout: () => ({ text: '텍스트 입력', x: 40, y: 36, width: 60, height: 14, angle: 0, isPlaceholder: true }),
    },
  });

  assert.equal(part, 'trendline-text-guide');
});
