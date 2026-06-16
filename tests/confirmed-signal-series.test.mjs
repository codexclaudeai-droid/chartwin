import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeConfirmedSignalSeriesLength,
  normalizeSignalSeriesLength,
} from '../src/strategy/signal-series.ts';

test('confirmed signal series keeps closed historical candles', () => {
  assert.deepEqual(
    normalizeConfirmedSignalSeriesLength([1, -1, 1], [
      { time: 1000 },
      { time: 1060 },
      { time: 1120 },
    ], '1m', 1300),
    [1, -1, 1],
  );
});

test('confirmed signal series clears only the still-open current candle', () => {
  assert.deepEqual(
    normalizeConfirmedSignalSeriesLength([1, -1, 1], [
      { time: 1000 },
      { time: 1060 },
      { time: 1120 },
    ], '1m', 1150),
    [1, -1, 0],
  );
});

test('raw signal normalization remains available for non-confirmed rendering paths', () => {
  assert.deepEqual(normalizeSignalSeriesLength([1, -1, 1], 3), [1, -1, 1]);
});
