import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateCci(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 20));
  return candles.map((candle, i) => {
    if (i < safePeriod - 1) return null;
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const window = candles
      .slice(i - safePeriod + 1, i + 1)
      .map((item) => (item.high + item.low + item.close) / 3);
    const mean = window.reduce((sum, value) => sum + value, 0) / safePeriod;
    const meanDeviation = window.reduce((sum, value) => sum + Math.abs(value - mean), 0) / safePeriod;
    return meanDeviation === 0 ? 0 : (typicalPrice - mean) / (0.015 * meanDeviation);
  });
}
