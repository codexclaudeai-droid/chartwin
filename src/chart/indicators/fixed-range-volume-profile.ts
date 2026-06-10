import type { CandleData, FootprintPriceLevel } from '../../types.ts';
import type { IndicatorCandle } from './types.ts';

export type FixedRangeVolumeMode = 'total' | 'up_down' | 'delta';

export interface FixedRangeVolumeProfileBucket {
  up: number;
  down: number;
  total: number;
  delta: number;
  footprintVolume: number;
  ohlcvVolume: number;
}

export function getFixedRangeCandles(
  candles: CandleData[],
  rangeStartTime: number | undefined,
  rangeEndTime: number | undefined,
): CandleData[] {
  if (!candles.length) return [];
  const fallbackEnd = candles[candles.length - 1]?.time;
  const fallbackStart = candles[Math.max(0, candles.length - Math.min(120, candles.length))]?.time;
  const rawStart = Number.isFinite(Number(rangeStartTime)) ? Number(rangeStartTime) : fallbackStart;
  const rawEnd = Number.isFinite(Number(rangeEndTime)) ? Number(rangeEndTime) : fallbackEnd;
  const start = Math.min(rawStart, rawEnd);
  const end = Math.max(rawStart, rawEnd);
  return candles.filter((candle) => candle.time >= start && candle.time <= end);
}

function addLevelToBucket(params: {
  buckets: FixedRangeVolumeProfileBucket[];
  rows: number;
  minPrice: number;
  maxPrice: number;
  bucketSpan: number;
  price: number;
  buyVolume: number;
  sellVolume: number;
  source: 'footprint' | 'ohlcv';
}): void {
  const { buckets, rows, minPrice, maxPrice, bucketSpan, price, buyVolume, sellVolume, source } = params;
  if (!(bucketSpan > 0) || price < minPrice || price > maxPrice) return;
  const index = Math.max(0, Math.min(rows - 1, Math.floor((price - minPrice) / bucketSpan)));
  const bucket = buckets[index];
  const up = Math.max(0, Number(buyVolume) || 0);
  const down = Math.max(0, Number(sellVolume) || 0);
  bucket.up += up;
  bucket.down += down;
  bucket.total += up + down;
  bucket.delta = bucket.up - bucket.down;
  if (source === 'footprint') bucket.footprintVolume += up + down;
  else bucket.ohlcvVolume += up + down;
}

function distributeOhlcvCandle(params: {
  buckets: FixedRangeVolumeProfileBucket[];
  rows: number;
  minPrice: number;
  maxPrice: number;
  bucketSpan: number;
  candle: IndicatorCandle;
}): void {
  const { buckets, rows, minPrice, maxPrice, bucketSpan, candle } = params;
  const candleLow = Math.max(minPrice, Math.min(candle.low, candle.high));
  const candleHigh = Math.min(maxPrice, Math.max(candle.low, candle.high));
  const candleVol = Number(candle.volume);
  if (!Number.isFinite(candleVol) || candleVol <= 0 || candleHigh < candleLow || !(bucketSpan > 0)) return;
  const startBin = Math.max(0, Math.min(rows - 1, Math.floor((candleLow - minPrice) / bucketSpan)));
  const endBin = Math.max(0, Math.min(rows - 1, Math.floor((candleHigh - minPrice) / bucketSpan)));
  const from = Math.min(startBin, endBin);
  const to = Math.max(startBin, endBin);
  const touched = Math.max(1, to - from + 1);
  const allocated = candleVol / touched;
  const buyVolume = Number.isFinite(Number((candle as CandleData).buyVolume))
    ? Math.max(0, Number((candle as CandleData).buyVolume) / touched)
    : (candle.close >= candle.open ? allocated : 0);
  const sellVolume = Number.isFinite(Number((candle as CandleData).sellVolume))
    ? Math.max(0, Number((candle as CandleData).sellVolume) / touched)
    : (candle.close >= candle.open ? 0 : allocated);

  for (let index = from; index <= to; index += 1) {
    const bucket = buckets[index];
    bucket.up += buyVolume;
    bucket.down += sellVolume;
    bucket.total += buyVolume + sellVolume;
    bucket.delta = bucket.up - bucket.down;
    bucket.ohlcvVolume += buyVolume + sellVolume;
  }
}

function hasUsableFootprint(levels: FootprintPriceLevel[] | undefined): levels is FootprintPriceLevel[] {
  return Array.isArray(levels) && levels.some((level) => Number(level.totalVolume) > 0 || Number(level.buyVolume) > 0 || Number(level.sellVolume) > 0);
}

export function buildFixedRangeVolumeProfile(params: {
  candles: CandleData[];
  rows: number;
  minPrice: number;
  maxPrice: number;
}): { buckets: FixedRangeVolumeProfileBucket[]; bucketSpan: number; maxTotal: number; maxAbsDelta: number; footprintRatio: number; pocIndex: number } {
  const { candles, rows, minPrice, maxPrice } = params;
  const safeRows = Math.max(1, Math.min(450, Math.floor(rows)));
  const bucketSpan = (maxPrice - minPrice) / safeRows;
  const buckets = Array.from({ length: safeRows }, () => ({
    up: 0,
    down: 0,
    total: 0,
    delta: 0,
    footprintVolume: 0,
    ohlcvVolume: 0,
  }));
  if (!(bucketSpan > 0)) return { buckets, bucketSpan, maxTotal: 0, maxAbsDelta: 0, footprintRatio: 0, pocIndex: 0 };

  candles.forEach((candle) => {
    if (hasUsableFootprint(candle.footprint)) {
      candle.footprint.forEach((level) => {
        addLevelToBucket({
          buckets,
          rows: safeRows,
          minPrice,
          maxPrice,
          bucketSpan,
          price: Number(level.price),
          buyVolume: Number(level.buyVolume),
          sellVolume: Number(level.sellVolume),
          source: 'footprint',
        });
      });
      return;
    }
    distributeOhlcvCandle({ buckets, rows: safeRows, minPrice, maxPrice, bucketSpan, candle });
  });

  let pocIndex = 0;
  let pocVolume = -1;
  buckets.forEach((bucket, index) => {
    if (bucket.total > pocVolume) {
      pocVolume = bucket.total;
      pocIndex = index;
    }
  });
  const footprintVolume = buckets.reduce((sum, bucket) => sum + bucket.footprintVolume, 0);
  const totalVolume = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  return {
    buckets,
    bucketSpan,
    maxTotal: Math.max(...buckets.map((bucket) => bucket.total), 0),
    maxAbsDelta: Math.max(...buckets.map((bucket) => Math.abs(bucket.delta)), 0),
    footprintRatio: totalVolume > 0 ? footprintVolume / totalVolume : 0,
    pocIndex,
  };
}

