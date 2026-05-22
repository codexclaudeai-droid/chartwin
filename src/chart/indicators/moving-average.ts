import { SMA } from 'technicalindicators';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateMa(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  const closes = candles.map((d) => d.close);
  const values = SMA.calculate({ period: safePeriod, values: closes });
  const out: NullableSeries = new Array(candles.length).fill(null);
  for (let i = safePeriod - 1; i < candles.length; i += 1) {
    out[i] = values[i - (safePeriod - 1)] ?? null;
  }
  return out;
}

export function calculateEmaFromValues(values: number[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  if (values.length < safePeriod) return new Array(values.length).fill(null);
  const k = 2 / (safePeriod + 1);
  const out: NullableSeries = new Array(safePeriod - 1).fill(null);
  let ema = values.slice(0, safePeriod).reduce((sum, value) => sum + value, 0) / safePeriod;
  out.push(ema);
  for (let i = safePeriod; i < values.length; i += 1) {
    ema = values[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

export function calculateEma(candles: IndicatorCandle[], period: number): NullableSeries {
  return calculateEmaFromValues(candles.map((d) => d.close), period);
}
