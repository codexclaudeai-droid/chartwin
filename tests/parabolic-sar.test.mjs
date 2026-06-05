import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateParabolicSar } from '../src/chart/indicators/index.ts';

const candle = (high, low, close = (high + low) / 2) => ({
  open: close,
  high,
  low,
  close,
  volume: 1,
});

test('calculates TradingView-style Parabolic SAR with default factors', () => {
  const candles = [
    candle(10, 9),
    candle(11, 9.5),
    candle(12, 10),
    candle(13, 11),
    candle(12.5, 10.5),
    candle(11, 9),
    candle(10, 8),
    candle(9, 7),
  ];

  const sar = calculateParabolicSar(candles, 0.02, 0.02, 0.2);

  assert.deepEqual(
    sar.map((value) => value == null ? null : Number(value.toFixed(6))),
    [null, 9, 9, 9.12, 9.3528, 13, 12.92, 12.7232],
  );
});

test('returns null warmup values when there is not enough price history', () => {
  assert.deepEqual(calculateParabolicSar([], 0.02, 0.02, 0.2), []);
  assert.deepEqual(calculateParabolicSar([candle(10, 9)], 0.02, 0.02, 0.2), [null]);
});
