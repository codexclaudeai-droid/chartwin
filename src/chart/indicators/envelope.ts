import { calculateMa } from './moving-average.ts';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface EnvelopeResult {
  mid: NullableSeries;
  upper: NullableSeries;
  lower: NullableSeries;
}

export function calculateEnvelope(candles: IndicatorCandle[], period: number, pct: number): EnvelopeResult {
  const mid = calculateMa(candles, period);
  const normalizedPct = Number.isFinite(Number(pct)) ? Number(pct) : 0;
  return {
    mid,
    upper: mid.map((value) => (value != null ? value * (1 + normalizedPct / 100) : null)),
    lower: mid.map((value) => (value != null ? value * (1 - normalizedPct / 100) : null)),
  };
}
