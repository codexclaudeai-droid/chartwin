import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface WilliamsAlligatorOptions {
  jawLength?: number;
  teethLength?: number;
  lipsLength?: number;
  jawOffset?: number;
  teethOffset?: number;
  lipsOffset?: number;
}

export interface WilliamsAlligatorResult {
  jaw: NullableSeries;
  teeth: NullableSeries;
  lips: NullableSeries;
  offsets: {
    jaw: number;
    teeth: number;
    lips: number;
  };
}

function normalizePeriod(value: unknown, fallback: number): number {
  return Math.max(1, Math.floor(Number(value ?? fallback) || fallback));
}

function normalizeOffset(value: unknown, fallback: number): number {
  const numeric = Number(value ?? fallback);
  return Math.max(0, Math.floor(Number.isFinite(numeric) ? numeric : fallback));
}

function calculateSmma(values: number[], period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let smma = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = smma;
  for (let i = period; i < values.length; i += 1) {
    smma = (smma * (period - 1) + values[i]) / period;
    out[i] = smma;
  }
  return out;
}

export function calculateWilliamsAlligator(
  candles: IndicatorCandle[],
  options: WilliamsAlligatorOptions = {},
): WilliamsAlligatorResult {
  const jawLength = normalizePeriod(options.jawLength, 13);
  const teethLength = normalizePeriod(options.teethLength, 8);
  const lipsLength = normalizePeriod(options.lipsLength, 5);
  const hl2 = candles.map((candle) => (candle.high + candle.low) / 2);

  return {
    jaw: calculateSmma(hl2, jawLength),
    teeth: calculateSmma(hl2, teethLength),
    lips: calculateSmma(hl2, lipsLength),
    offsets: {
      jaw: normalizeOffset(options.jawOffset, 8),
      teeth: normalizeOffset(options.teethOffset, 5),
      lips: normalizeOffset(options.lipsOffset, 3),
    },
  };
}
