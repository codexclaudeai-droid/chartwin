import type { IndicatorCandle, NullableSeries } from './types.ts';

function sma(values: NullableSeries, period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - safePeriod + 1), i + 1)
      .filter((value) => value != null) as number[];
    return slice.length === safePeriod ? slice.reduce((sum, value) => sum + value, 0) / safePeriod : null;
  });
}

export interface StochasticResult {
  k: NullableSeries;
  d: NullableSeries;
}

export function calculateStochastic(
  candles: IndicatorCandle[],
  kPeriod: number,
  dPeriod: number,
): StochasticResult {
  const safeKPeriod = Math.max(1, Math.floor(Number(kPeriod) || 14));
  const safeDPeriod = Math.max(1, Math.floor(Number(dPeriod) || 3));
  const rawK: NullableSeries = candles.map((candle, i) => {
    if (i < safeKPeriod - 1) return null;
    const window = candles.slice(i - safeKPeriod + 1, i + 1);
    const high = Math.max(...window.map((item) => item.high));
    const low = Math.min(...window.map((item) => item.low));
    return high === low ? 50 : ((candle.close - low) / (high - low)) * 100;
  });
  const k = sma(rawK, 3);
  return { k, d: sma(k, safeDPeriod) };
}
