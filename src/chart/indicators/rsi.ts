import { RSI } from 'technicalindicators';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateRsi(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 14));
  const closes = candles.map((d) => d.close);
  const values = RSI.calculate({ period: safePeriod, values: closes });
  const out: NullableSeries = new Array(candles.length).fill(null);
  for (let i = safePeriod; i < candles.length; i += 1) {
    out[i] = values[i - safePeriod] ?? null;
  }
  return out;
}
