import type { IndicatorCandle } from '../indicators/index.ts';
import type { IndicatorLineStyle } from './main-line-renderer.ts';

interface VolumeProfileBucket {
  up: number;
  down: number;
  total: number;
}

export function buildVolumeProfileBuckets(params: {
  candles: IndicatorCandle[];
  rows: number;
  minPrice: number;
  maxPrice: number;
}): { buckets: VolumeProfileBucket[]; bucketSpan: number; maxBucketVolume: number; pocIndex: number } {
  const { candles, rows, minPrice, maxPrice } = params;
  const safeRows = Math.max(1, Math.floor(rows));
  const bucketSpan = (maxPrice - minPrice) / safeRows;
  const buckets = Array.from({ length: safeRows }, () => ({ up: 0, down: 0, total: 0 }));
  if (!(bucketSpan > 0)) return { buckets, bucketSpan, maxBucketVolume: 0, pocIndex: 0 };

  candles.forEach((candle) => {
    const candleLow = Math.max(minPrice, Math.min(candle.low, candle.high));
    const candleHigh = Math.min(maxPrice, Math.max(candle.low, candle.high));
    const candleVol = Number(candle.volume);
    if (!Number.isFinite(candleVol) || candleVol <= 0 || candleHigh < candleLow) return;

    const startBin = Math.max(0, Math.min(safeRows - 1, Math.floor((candleLow - minPrice) / bucketSpan)));
    const endBin = Math.max(0, Math.min(safeRows - 1, Math.floor((candleHigh - minPrice) / bucketSpan)));
    const from = Math.min(startBin, endBin);
    const to = Math.max(startBin, endBin);
    const touched = Math.max(1, to - from + 1);
    const allocated = candleVol / touched;
    const isUp = candle.close >= candle.open;

    for (let index = from; index <= to; index += 1) {
      const bucket = buckets[index];
      if (isUp) bucket.up += allocated;
      else bucket.down += allocated;
      bucket.total += allocated;
    }
  });

  let pocIndex = 0;
  let pocValue = -1;
  buckets.forEach((bucket, index) => {
    if (bucket.total > pocValue) {
      pocValue = bucket.total;
      pocIndex = index;
    }
  });

  return {
    buckets,
    bucketSpan,
    maxBucketVolume: Math.max(...buckets.map((bucket) => bucket.total), 0),
    pocIndex,
  };
}

export function renderVolumeProfileBackground(params: {
  ctx: CanvasRenderingContext2D;
  enabled: boolean;
  candles: IndicatorCandle[];
  rows: number;
  minPrice: number;
  maxPrice: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  plotTop: number;
  plotBottom: number;
  widthRatio: number;
  upFillColor: string;
  downFillColor: string;
  pocStrokeColor: string;
  pocStyle: IndicatorLineStyle;
  showUp: boolean;
  showDown: boolean;
  showPoc: boolean;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    enabled,
    candles,
    rows,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    widthRatio,
    upFillColor,
    downFillColor,
    pocStrokeColor,
    pocStyle,
    showUp,
    showDown,
    showPoc,
    getY,
  } = params;
  if (!enabled || rows <= 0) return;

  const { buckets, bucketSpan, maxBucketVolume, pocIndex } = buildVolumeProfileBuckets({
    candles,
    rows,
    minPrice,
    maxPrice,
  });
  if (!(bucketSpan > 0) || maxBucketVolume <= 0) return;

  const profileMaxWidth = chartWidth * widthRatio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, plotTop, chartWidth, Math.max(1, plotBottom - plotTop));
  ctx.clip();

  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (bucket.total <= 0) continue;

    const low = minPrice + index * bucketSpan;
    const high = low + bucketSpan;
    const yTop = getY(high);
    const yBottom = getY(low);
    const y = Math.min(yTop, yBottom);
    const height = Math.max(1, Math.abs(yBottom - yTop) - 1);
    const totalWidth = (bucket.total / maxBucketVolume) * profileMaxWidth;
    if (totalWidth <= 0) continue;

    const downWidth = totalWidth * (bucket.down / bucket.total);
    const upWidth = Math.max(0, totalWidth - downWidth);
    let xCursor = chartRight - totalWidth;

    if (showDown && downWidth > 0.5) {
      ctx.fillStyle = downFillColor;
      ctx.fillRect(xCursor, y, downWidth, height);
    }
    xCursor += downWidth;
    if (showUp && upWidth > 0.5) {
      ctx.fillStyle = upFillColor;
      ctx.fillRect(xCursor, y, upWidth, height);
    }
  }

  if (showPoc) {
    const pocLow = minPrice + pocIndex * bucketSpan;
    const pocHigh = pocLow + bucketSpan;
    const pocY = (getY(pocLow) + getY(pocHigh)) * 0.5;
    ctx.strokeStyle = pocStrokeColor;
    ctx.lineWidth = pocStyle.width;
    ctx.setLineDash(pocStyle.dash);
    ctx.beginPath();
    ctx.moveTo(chartRight - profileMaxWidth, pocY);
    ctx.lineTo(chartRight, pocY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
