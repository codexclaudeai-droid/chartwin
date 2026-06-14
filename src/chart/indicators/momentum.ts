import type { IndicatorCandle } from './types.ts';

export function calculateMomentum(candles: IndicatorCandle[], period = 10): Array<number | null> {
  const length = Math.max(1, Math.floor(Number(period) || 10));
  return candles.map((candle, index) => {
    if (index < length) return null;
    const previous = candles[index - length];
    if (!previous) return null;
    return candle.close - previous.close;
  });
}
