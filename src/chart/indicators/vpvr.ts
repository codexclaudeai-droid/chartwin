import type { IndicatorCandle } from './types.ts';

export type VpvrVolumeMode = 'total' | 'up_down' | 'delta';
export type VpvrPlacement = 'left' | 'right';

export interface VpvrBucket {
  up: number;
  down: number;
  total: number;
  delta: number;
}

export interface VpvrLayout {
  rowLayout: 'number_of_rows' | 'ticks_per_row';
  rowSize: number;
  volumeMode: VpvrVolumeMode;
  valueAreaVolume: number;
  placement: VpvrPlacement;
  widthRatio: number;
  rows: number;
  effectiveBucketSpan: number;
  regionWidth: number;
  regionStart: number;
  regionEnd: number;
  centerX: number;
}

export function calculateVpvrLayout(params: {
  vp: any;
  minPrice: number;
  maxPrice: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  symbolPriceDigits: number;
}): VpvrLayout {
  const { vp, minPrice, maxPrice, chartLeft, chartRight, chartWidth, symbolPriceDigits } = params;
  const rowLayout = (vp.rowsLayout === 'ticks_per_row' ? 'ticks_per_row' : 'number_of_rows') as 'number_of_rows' | 'ticks_per_row';
  const rowSize = Math.max(1, Math.floor(Number(vp.rowSize ?? 50) || 50));
  const volumeMode = ((vp.volumeMode === 'total' || vp.volumeMode === 'delta') ? vp.volumeMode : 'up_down') as VpvrVolumeMode;
  const valueAreaVolume = Math.max(1, Math.min(100, Number(vp.valueAreaVolume ?? 70) || 70));
  const placement = vp.placement === 'left' ? 'left' : 'right';
  const widthRatio = Math.max(0.05, Math.min(0.45, (Number(vp.widthPct ?? 22) || 22) / 100));
  const tickSize = Math.max(10 ** -symbolPriceDigits, 1e-12);
  const totalRange = Math.max(1e-12, maxPrice - minPrice);
  const bucketSpan = rowLayout === 'ticks_per_row'
    ? Math.max(tickSize * rowSize, tickSize)
    : Math.max(totalRange / Math.max(1, rowSize), tickSize);
  const rows = Math.max(1, Math.min(450, Math.ceil(totalRange / bucketSpan)));
  const effectiveBucketSpan = totalRange / rows;
  const regionWidth = chartWidth * widthRatio;
  const regionStart = placement === 'left' ? chartLeft : (chartRight - regionWidth);
  const regionEnd = placement === 'left' ? (chartLeft + regionWidth) : chartRight;
  const centerX = (regionStart + regionEnd) / 2;

  return {
    rowLayout,
    rowSize,
    volumeMode,
    valueAreaVolume,
    placement,
    widthRatio,
    rows,
    effectiveBucketSpan,
    regionWidth,
    regionStart,
    regionEnd,
    centerX,
  };
}

export function buildVpvrProfile(params: {
  candles: IndicatorCandle[];
  rows: number;
  minPrice: number;
  maxPrice: number;
  bucketSpan: number;
}): VpvrBucket[] {
  const { candles, rows, minPrice, maxPrice, bucketSpan } = params;
  const profile = Array.from({ length: rows }, () => ({ up: 0, down: 0, total: 0, delta: 0 }));
  candles.forEach((candle) => {
    const candleLow = Math.max(minPrice, Math.min(candle.low, candle.high));
    const candleHigh = Math.min(maxPrice, Math.max(candle.low, candle.high));
    const candleVol = Number(candle.volume);
    if (!Number.isFinite(candleVol) || candleVol <= 0 || candleHigh < candleLow) return;
    const startBin = Math.max(0, Math.min(rows - 1, Math.floor((candleLow - minPrice) / bucketSpan)));
    const endBin = Math.max(0, Math.min(rows - 1, Math.floor((candleHigh - minPrice) / bucketSpan)));
    const from = Math.min(startBin, endBin);
    const to = Math.max(startBin, endBin);
    const touched = Math.max(1, to - from + 1);
    const allocated = candleVol / touched;
    const isUp = candle.close >= candle.open;
    for (let index = from; index <= to; index += 1) {
      const bucket = profile[index];
      if (isUp) bucket.up += allocated;
      else bucket.down += allocated;
      bucket.total += allocated;
      bucket.delta = bucket.up - bucket.down;
    }
  });
  return profile;
}

export function calculateVpvrValueArea(
  profile: VpvrBucket[],
  valueAreaVolume: number,
): { pocIndex: number; vaLow: number; vaHigh: number } {
  let pocIndex = 0;
  let pocVolume = -1;
  profile.forEach((bucket, index) => {
    if (bucket.total > pocVolume) {
      pocVolume = bucket.total;
      pocIndex = index;
    }
  });

  let vaLow = pocIndex;
  let vaHigh = pocIndex;
  let vaAccum = profile[pocIndex]?.total ?? 0;
  const totalVolume = profile.reduce((sum, bucket) => sum + bucket.total, 0);
  const vaTarget = totalVolume * (valueAreaVolume / 100);
  while (vaAccum < vaTarget && (vaLow > 0 || vaHigh < profile.length - 1)) {
    const nextLowVol = vaLow > 0 ? profile[vaLow - 1].total : -1;
    const nextHighVol = vaHigh < profile.length - 1 ? profile[vaHigh + 1].total : -1;
    if (nextHighVol >= nextLowVol && vaHigh < profile.length - 1) {
      vaHigh += 1;
      vaAccum += Math.max(0, nextHighVol);
    } else if (vaLow > 0) {
      vaLow -= 1;
      vaAccum += Math.max(0, nextLowVol);
    } else {
      break;
    }
  }

  return { pocIndex, vaLow, vaHigh };
}
