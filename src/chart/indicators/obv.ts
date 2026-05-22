import type { IndicatorCandle } from './types.ts';

export function calculateObv(candles: IndicatorCandle[]): number[] {
  if (!candles.length) return [];
  const obv = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const previous = obv[i - 1];
    if (candles[i].close > candles[i - 1].close) {
      obv.push(previous + candles[i].volume);
    } else if (candles[i].close < candles[i - 1].close) {
      obv.push(previous - candles[i].volume);
    } else {
      obv.push(previous);
    }
  }
  return obv;
}
