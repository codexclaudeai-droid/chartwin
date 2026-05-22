import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface DmiResult {
  plusDI: NullableSeries;
  minusDI: NullableSeries;
  adx: NullableSeries;
}

export function calculateDmi(candles: IndicatorCandle[], period: number): DmiResult {
  const safePeriod = Math.max(1, Math.floor(Number(period) || 14));
  const plusDI: NullableSeries = [];
  const minusDI: NullableSeries = [];
  const adx: NullableSeries = [];
  let smoothedTR = 0;
  let smoothedPlusDM = 0;
  let smoothedMinusDM = 0;
  let adxSum = 0;
  let adxCount = 0;
  let previousAdx: number | null = null;

  for (let i = 0; i < candles.length; i += 1) {
    if (i === 0) {
      plusDI.push(null);
      minusDI.push(null);
      adx.push(null);
      continue;
    }

    const high = candles[i].high;
    const low = candles[i].low;
    const previousHigh = candles[i - 1].high;
    const previousLow = candles[i - 1].low;
    const previousClose = candles[i - 1].close;
    const trueRange = Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
    const upMove = high - previousHigh;
    const downMove = previousLow - low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    if (i < safePeriod) {
      smoothedTR += trueRange;
      smoothedPlusDM += plusDM;
      smoothedMinusDM += minusDM;
      plusDI.push(null);
      minusDI.push(null);
      adx.push(null);
    } else if (i === safePeriod) {
      smoothedTR += trueRange;
      smoothedPlusDM += plusDM;
      smoothedMinusDM += minusDM;
      const plus = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minus = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      plusDI.push(plus);
      minusDI.push(minus);
      adxSum += plus + minus > 0 ? (Math.abs(plus - minus) / (plus + minus)) * 100 : 0;
      adxCount += 1;
      adx.push(null);
    } else {
      smoothedTR = smoothedTR - smoothedTR / safePeriod + trueRange;
      smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / safePeriod + plusDM;
      smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / safePeriod + minusDM;
      const plus = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minus = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      plusDI.push(plus);
      minusDI.push(minus);
      const dx = plus + minus > 0 ? (Math.abs(plus - minus) / (plus + minus)) * 100 : 0;
      if (adxCount < safePeriod) {
        adxSum += dx;
        adxCount += 1;
        if (adxCount === safePeriod) {
          previousAdx = adxSum / safePeriod;
          adx.push(previousAdx);
        } else {
          adx.push(null);
        }
      } else {
        previousAdx = (previousAdx! * (safePeriod - 1) + dx) / safePeriod;
        adx.push(previousAdx);
      }
    }
  }

  return { plusDI, minusDI, adx };
}
