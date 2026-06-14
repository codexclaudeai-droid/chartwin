import type { IndicatorCandle, NullableSeries } from './types.ts';

export interface DonchianChannelResult {
  upper: NullableSeries;
  middle: NullableSeries;
  lower: NullableSeries;
}

export function calculateDonchianChannel(candles: IndicatorCandle[], period = 20): DonchianChannelResult {
  const length = Math.max(1, Math.floor(Number(period) || 20));
  const upper: NullableSeries = [];
  const middle: NullableSeries = [];
  const lower: NullableSeries = [];

  candles.forEach((_, index) => {
    if (index < length - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      return;
    }

    let highest = -Infinity;
    let lowest = Infinity;
    for (let i = index - length + 1; i <= index; i += 1) {
      const candle = candles[i];
      if (!candle) continue;
      highest = Math.max(highest, candle.high);
      lowest = Math.min(lowest, candle.low);
    }

    if (!Number.isFinite(highest) || !Number.isFinite(lowest)) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      return;
    }

    upper.push(highest);
    lower.push(lowest);
    middle.push((highest + lowest) / 2);
  });

  return { upper, middle, lower };
}
