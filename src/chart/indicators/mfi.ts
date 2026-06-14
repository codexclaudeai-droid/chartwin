import type { IndicatorCandle, NullableSeries } from './types.ts';

export function calculateMfi(candles: IndicatorCandle[], period: number): NullableSeries {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 14));
  const out: NullableSeries = new Array(candles.length).fill(null);
  if (candles.length <= safePeriod) return out;

  const typicalPrices = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const positiveFlow = new Array(candles.length).fill(0);
  const negativeFlow = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i += 1) {
    const rawMoneyFlow = typicalPrices[i] * Math.max(0, Number(candles[i].volume) || 0);
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      positiveFlow[i] = rawMoneyFlow;
    } else if (typicalPrices[i] < typicalPrices[i - 1]) {
      negativeFlow[i] = rawMoneyFlow;
    }
  }

  for (let i = safePeriod; i < candles.length; i += 1) {
    let positiveSum = 0;
    let negativeSum = 0;
    for (let j = i - safePeriod + 1; j <= i; j += 1) {
      positiveSum += positiveFlow[j];
      negativeSum += negativeFlow[j];
    }
    if (negativeSum === 0) {
      out[i] = positiveSum === 0 ? 50 : 100;
    } else {
      const moneyRatio = positiveSum / negativeSum;
      out[i] = 100 - 100 / (1 + moneyRatio);
    }
  }

  return out;
}
