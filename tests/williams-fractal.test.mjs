import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWilliamsFractals } from '../src/chart/indicators/index.ts';

const candle = (high, low) => ({ open: low, high, low, close: high });

test('detects standard five-bar Williams high and low fractals', () => {
  const candles = [
    candle(10, 5),
    candle(11, 4),
    candle(15, 6),
    candle(12, 3),
    candle(9, 2),
    candle(8, 5),
    candle(7, 1),
    candle(9, 3),
    candle(10, 4),
  ];

  const fractals = calculateWilliamsFractals(candles);

  assert.equal(fractals.span, 2);
  assert.equal(fractals.highs[2], 15);
  assert.equal(fractals.lows[6], 1);
  assert.equal(fractals.highs[0], null);
  assert.equal(fractals.highs[8], null);
});

test('requires strict highs and lows so equal neighboring values do not mark fractals', () => {
  const candles = [
    candle(10, 5),
    candle(11, 4),
    candle(15, 2),
    candle(15, 3),
    candle(9, 1),
  ];

  const fractals = calculateWilliamsFractals(candles);

  assert.deepEqual(fractals.highs, [null, null, null, null, null]);
  assert.deepEqual(fractals.lows, [null, null, null, null, null]);
});

test('supports a variable span for wider Williams fractal periods', () => {
  const candles = [
    candle(10, 7),
    candle(11, 6),
    candle(12, 5),
    candle(20, 4),
    candle(14, 5),
    candle(13, 6),
    candle(12, 7),
    candle(11, 3),
    candle(12, 4),
    candle(13, 5),
    candle(14, 6),
  ];

  const fractals = calculateWilliamsFractals(candles, 3);

  assert.equal(fractals.span, 3);
  assert.equal(fractals.highs[3], 20);
  assert.equal(fractals.lows[7], 3);
  assert.equal(fractals.highs[2], null);
});
