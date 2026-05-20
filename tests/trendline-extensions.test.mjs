import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTrendlineScreenLine,
  isTrendlineKind,
} from '../src/ui/workspace/drawing-utils.ts';

test('recognizes all trendline-family drawing kinds', () => {
  assert.equal(isTrendlineKind('trendline'), true);
  assert.equal(isTrendlineKind('extended-trendline'), true);
  assert.equal(isTrendlineKind('ray-trendline'), true);
  assert.equal(isTrendlineKind('channel'), false);
});

test('keeps classic trendline bounded between both anchors', () => {
  const line = getTrendlineScreenLine(
    { x: 20, y: 80 },
    { x: 80, y: 20 },
    { left: 0, right: 100, top: 0, bottom: 100 },
    'trendline',
  );
  assert.deepEqual(line, { x1: 20, y1: 80, x2: 80, y2: 20 });
});

test('extends both directions for extended trendlines', () => {
  const line = getTrendlineScreenLine(
    { x: 20, y: 80 },
    { x: 80, y: 20 },
    { left: 0, right: 100, top: 0, bottom: 100 },
    'extended-trendline',
  );
  assert.deepEqual(line, { x1: 0, y1: 100, x2: 100, y2: 0 });
});

test('extends only through the second anchor for ray trendlines', () => {
  const line = getTrendlineScreenLine(
    { x: 20, y: 80 },
    { x: 80, y: 20 },
    { left: 0, right: 100, top: 0, bottom: 100 },
    'ray-trendline',
  );
  assert.deepEqual(line, { x1: 20, y1: 80, x2: 100, y2: 0 });
});
