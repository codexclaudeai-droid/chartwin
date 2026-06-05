export interface ParabolicSarCandle {
  high: number;
  low: number;
  close: number;
}

function safeFactor(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

export function calculateParabolicSar(
  candles: ParabolicSarCandle[],
  start = 0.02,
  increment = 0.02,
  maximum = 0.2,
): Array<number | null> {
  const result: Array<number | null> = new Array(candles.length).fill(null);
  if (candles.length < 2) return result;

  const stepStart = safeFactor(start, 0.02);
  const stepIncrement = safeFactor(increment, 0.02);
  const stepMaximum = safeFactor(maximum, 0.2);
  let isLong = candles[1].close >= candles[0].close;
  let acceleration = stepStart;
  let extremePoint = isLong
    ? Math.max(candles[0].high, candles[1].high)
    : Math.min(candles[0].low, candles[1].low);
  let sar = isLong
    ? Math.min(candles[0].low, candles[1].low)
    : Math.max(candles[0].high, candles[1].high);

  result[1] = sar;

  for (let index = 2; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const previous2 = candles[index - 2];
    sar = sar + acceleration * (extremePoint - sar);

    if (isLong) {
      sar = Math.min(sar, previous.low, previous2.low);
      if (current.low < sar) {
        isLong = false;
        sar = extremePoint;
        extremePoint = current.low;
        acceleration = stepStart;
      } else if (current.high > extremePoint) {
        extremePoint = current.high;
        acceleration = Math.min(acceleration + stepIncrement, stepMaximum);
      }
    } else {
      sar = Math.max(sar, previous.high, previous2.high);
      if (current.high > sar) {
        isLong = true;
        sar = extremePoint;
        extremePoint = current.high;
        acceleration = stepStart;
      } else if (current.low < extremePoint) {
        extremePoint = current.low;
        acceleration = Math.min(acceleration + stepIncrement, stepMaximum);
      }
    }

    result[index] = sar;
  }

  return result;
}
