export interface WilliamsFractalCandle {
  high: number;
  low: number;
}

export interface WilliamsFractalResult {
  highs: Array<number | null>;
  lows: Array<number | null>;
  span: number;
}

export function calculateWilliamsFractals(
  candles: WilliamsFractalCandle[],
  span = 2,
): WilliamsFractalResult {
  const safeSpan = Math.max(1, Math.floor(Number(span) || 2));
  const highs: Array<number | null> = new Array(candles.length).fill(null);
  const lows: Array<number | null> = new Array(candles.length).fill(null);

  for (let i = safeSpan; i < candles.length - safeSpan; i += 1) {
    const current = candles[i];
    if (!current) continue;
    let isHigh = true;
    let isLow = true;

    for (let offset = 1; offset <= safeSpan; offset += 1) {
      const left = candles[i - offset];
      const right = candles[i + offset];
      if (!left || !right) {
        isHigh = false;
        isLow = false;
        break;
      }
      if (!(current.high > left.high && current.high > right.high)) isHigh = false;
      if (!(current.low < left.low && current.low < right.low)) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) highs[i] = current.high;
    if (isLow) lows[i] = current.low;
  }

  return { highs, lows, span: safeSpan };
}
