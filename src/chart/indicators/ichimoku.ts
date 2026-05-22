import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface IchimokuResult {
  tenkanLine: NullableSeries;
  kijunLine: NullableSeries;
  senkouA: NullableSeries;
  senkouB: NullableSeries;
  chikouSpan: NullableSeries;
}

function normalizePeriod(period: number): number {
  return Math.max(1, Math.floor(Number(period) || 1));
}

function midpoint(candles: IndicatorCandle[], index: number, period: number): number | null {
  if (index < period - 1) return null;
  let high = -Infinity;
  let low = Infinity;
  for (let i = index - period + 1; i <= index; i += 1) {
    high = Math.max(high, candles[i].high);
    low = Math.min(low, candles[i].low);
  }
  return (high + low) / 2;
}

export function calculateIchimoku(
  candles: IndicatorCandle[],
  tenkan: number,
  kijun: number,
  senkou: number,
): IchimokuResult {
  const tenkanPeriod = normalizePeriod(tenkan);
  const kijunPeriod = normalizePeriod(kijun);
  const senkouPeriod = normalizePeriod(senkou);
  const tenkanLine = candles.map((_, index) => midpoint(candles, index, tenkanPeriod));
  const kijunLine = candles.map((_, index) => midpoint(candles, index, kijunPeriod));
  const senkouA = tenkanLine.map((value, index) => (
    value != null && kijunLine[index] != null ? (value + kijunLine[index]!) / 2 : null
  ));
  const senkouB = candles.map((_, index) => midpoint(candles, index, senkouPeriod));
  const chikouSpan = candles.map((candle) => candle.close);
  return { tenkanLine, kijunLine, senkouA, senkouB, chikouSpan };
}
