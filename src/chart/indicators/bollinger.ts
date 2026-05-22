import { BollingerBands } from 'technicalindicators';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface BollingerBandsResult {
  middle: NullableSeries;
  upper: NullableSeries;
  lower: NullableSeries;
}

export function calculateBb(candles: IndicatorCandle[], period: number, stdDev: number): BollingerBandsResult {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 20));
  const safeStdDev = Math.max(0.1, Number(stdDev) || 2);
  const closes = candles.map((d) => d.close);
  const values = BollingerBands.calculate({ period: safePeriod, stdDev: safeStdDev, values: closes });
  const middle: NullableSeries = new Array(candles.length).fill(null);
  const upper: NullableSeries = new Array(candles.length).fill(null);
  const lower: NullableSeries = new Array(candles.length).fill(null);
  for (let i = safePeriod - 1; i < candles.length; i += 1) {
    const item = values[i - (safePeriod - 1)];
    if (!item) continue;
    middle[i] = item.middle;
    upper[i] = item.upper;
    lower[i] = item.lower;
  }
  return { middle, upper, lower };
}
