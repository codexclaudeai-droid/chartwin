import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateAtr(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 1));
  const out: NullableSeries = new Array(candles.length).fill(null);
  if (!candles.length) return out;

  const trueRanges = candles.map((candle, index) => {
    const prevClose = index > 0 ? candles[index - 1].close : candle.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    );
  });

  if (safePeriod === 1) {
    return trueRanges;
  }
  if (trueRanges.length < safePeriod) return out;

  let atr = trueRanges.slice(0, safePeriod).reduce((sum, value) => sum + value, 0) / safePeriod;
  out[safePeriod - 1] = atr;
  for (let i = safePeriod; i < trueRanges.length; i += 1) {
    atr = ((atr * (safePeriod - 1)) + trueRanges[i]) / safePeriod;
    out[i] = atr;
  }

  return out;
}
