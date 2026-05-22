import type { IndicatorCandle, NullableSeries } from './types.ts';

function weightedMovingAverage(values: Array<number | null>, period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  const denominator = safePeriod * (safePeriod + 1) / 2;
  const out: NullableSeries = new Array(values.length).fill(null);

  for (let i = safePeriod - 1; i < values.length; i += 1) {
    let weightedSum = 0;
    let complete = true;
    for (let j = 0; j < safePeriod; j += 1) {
      const value = values[i - safePeriod + 1 + j];
      if (value == null || !Number.isFinite(value)) {
        complete = false;
        break;
      }
      weightedSum += value * (j + 1);
    }
    out[i] = complete ? weightedSum / denominator : null;
  }

  return out;
}

export function calculateHma(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  const halfPeriod = Math.max(1, Math.floor(safePeriod / 2));
  const sqrtPeriod = Math.max(1, Math.floor(Math.sqrt(safePeriod)));
  const closes = candles.map((candle) => candle.close);
  const halfWma = weightedMovingAverage(closes, halfPeriod);
  const fullWma = weightedMovingAverage(closes, safePeriod);
  const diff: NullableSeries = closes.map((_, index) => {
    const half = halfWma[index];
    const full = fullWma[index];
    return half == null || full == null ? null : (2 * half) - full;
  });

  return weightedMovingAverage(diff, sqrtPeriod);
}
