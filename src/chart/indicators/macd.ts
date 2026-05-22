import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface MacdResult {
  macdLine: NullableSeries;
  sigLine: NullableSeries;
  hist: NullableSeries;
}

function calculateEmaSeries(values: number[], period: number): NullableSeries {
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

export function calculateMacd(
  candles: IndicatorCandle[],
  fast: number,
  slow: number,
  signal: number,
): MacdResult {
  const safeFast = Math.max(1, Math.floor(Number(fast) || 12));
  const safeSlow = Math.max(1, Math.floor(Number(slow) || 26));
  const safeSignal = Math.max(1, Math.floor(Number(signal) || 9));
  const closes = candles.map((d) => d.close);
  const fastEma = calculateEmaSeries(closes, safeFast);
  const slowEma = calculateEmaSeries(closes, safeSlow);
  const macdLine: NullableSeries = fastEma.map((fastValue, i) => (
    fastValue != null && slowEma[i] != null ? fastValue - slowEma[i]! : null
  ));
  const validMacd = macdLine.filter((v) => v != null) as number[];
  const signalEma = calculateEmaSeries(validMacd, safeSignal);
  const sigLine: NullableSeries = [];
  let validCount = 0;
  for (const value of macdLine) {
    if (value == null) {
      sigLine.push(null);
      continue;
    }
    validCount += 1;
    sigLine.push(validCount >= safeSignal ? (signalEma[validCount - 1] ?? null) : null);
  }
  const hist: NullableSeries = macdLine.map((value, i) => (
    value != null && sigLine[i] != null ? value - sigLine[i]! : null
  ));
  return { macdLine, sigLine, hist };
}
