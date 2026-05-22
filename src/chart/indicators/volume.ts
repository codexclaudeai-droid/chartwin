import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateCvd(candles: IndicatorCandle[]): number[] {
  if (!candles.length) return [];
  const cvd = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i];
    const delta = candle.close > candle.open
      ? candle.volume
      : candle.close < candle.open
        ? -candle.volume
        : 0;
    cvd.push(cvd[i - 1] + delta);
  }
  return cvd;
}

export function calculateVwap(candles: IndicatorCandle[]): NullableSeries {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  return candles.map((candle) => {
    cumulativePriceVolume += ((candle.high + candle.low + candle.close) / 3) * candle.volume;
    cumulativeVolume += candle.volume;
    return cumulativeVolume === 0 ? null : cumulativePriceVolume / cumulativeVolume;
  });
}
