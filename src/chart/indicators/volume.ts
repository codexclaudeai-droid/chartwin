import type { IndicatorCandle, NullableSeries } from './types.ts';

export type VwapAnchorPeriod = 'session' | 'week' | 'month' | 'quarter' | 'year' | 'decade' | 'century' | 'all' | 'custom';
export type VwapSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
export type VwapBandMode = 'standard-deviation' | 'percentage';

export interface VwapOptions {
  anchorPeriod?: VwapAnchorPeriod;
  source?: VwapSource;
  offset?: number;
  bandMode?: VwapBandMode;
  bandMultipliers?: [number, number, number];
  customBars?: number;
  sessionTimezone?: string;
}

export interface VwapBands {
  upper: [NullableSeries, NullableSeries, NullableSeries];
  lower: [NullableSeries, NullableSeries, NullableSeries];
}

export interface VwapResult {
  vwap: NullableSeries;
  bands: VwapBands;
  anchorStarts: number[];
}

const VWAP_ANCHOR_PERIODS = new Set<VwapAnchorPeriod>([
  'session', 'week', 'month', 'quarter', 'year', 'decade', 'century', 'all', 'custom',
]);
const VWAP_SOURCES = new Set<VwapSource>(['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4']);

export function calculateCvd(candles: IndicatorCandle[]): number[] {
  if (!candles.length) return [];
  const cvd = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i];
    const delta = candle.close > candle.open
      ? candle.volume
      : candle.close < candle.open
        ? -candle.volume
        : 0;
    cvd.push(cvd[i - 1] + delta);
  }
  return cvd;
}

function getTimeMs(candle: IndicatorCandle): number | null {
  const value = Number(candle.time);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function getWeekKey(year: number, month: number, dayOfMonth: number, weekday: number): string {
  const day = weekday || 7;
  const thursday = new Date(Date.UTC(year, month - 1, dayOfMonth + 4 - day));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-${week}`;
}

function getSessionDateParts(timeMs: number, timeZone: string): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  if (timeZone === 'UTC') {
    const date = new Date(timeMs);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      weekday: date.getUTCDay(),
    };
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(new Date(timeMs));
    const weekdayText = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayText.slice(0, 3));
    return {
      year: Number(parts.find((part) => part.type === 'year')?.value ?? 1970),
      month: Number(parts.find((part) => part.type === 'month')?.value ?? 1),
      day: Number(parts.find((part) => part.type === 'day')?.value ?? 1),
      weekday: weekday >= 0 ? weekday : 0,
    };
  } catch {
    return getSessionDateParts(timeMs, 'UTC');
  }
}

function getAnchorKey(candle: IndicatorCandle, anchorPeriod: VwapAnchorPeriod, sessionTimezone: string): string | null {
  if (anchorPeriod === 'all' || anchorPeriod === 'custom') return null;
  const timeMs = getTimeMs(candle);
  if (timeMs == null) return null;
  const { year, month, day, weekday } = getSessionDateParts(timeMs, sessionTimezone);
  if (anchorPeriod === 'century') return String(Math.floor((year - 1) / 100) + 1);
  if (anchorPeriod === 'decade') return String(Math.floor(year / 10) * 10);
  if (anchorPeriod === 'year') return String(year);
  if (anchorPeriod === 'quarter') return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  if (anchorPeriod === 'month') return `${year}-${month}`;
  if (anchorPeriod === 'week') return getWeekKey(year, month, day, weekday);
  return `${year}-${month}-${day}`;
}

function getSourcePrice(candle: IndicatorCandle, source: VwapSource): number {
  if (source === 'open') return candle.open;
  if (source === 'high') return candle.high;
  if (source === 'low') return candle.low;
  if (source === 'close') return candle.close;
  if (source === 'hl2') return (candle.high + candle.low) / 2;
  if (source === 'ohlc4') return (candle.open + candle.high + candle.low + candle.close) / 4;
  return (candle.high + candle.low + candle.close) / 3;
}

function applyOffset(values: NullableSeries, offset: number): NullableSeries {
  const roundedOffset = Math.trunc(offset);
  if (!roundedOffset) return values;
  const shifted: NullableSeries = new Array(values.length).fill(null);
  values.forEach((value, index) => {
    const targetIndex = index + roundedOffset;
    if (targetIndex >= 0 && targetIndex < shifted.length) shifted[targetIndex] = value;
  });
  return shifted;
}

function applyAnchorStartOffset(values: number[], offset: number): number[] {
  const roundedOffset = Math.trunc(offset);
  if (!roundedOffset) return values;
  const shifted: number[] = new Array(values.length).fill(0);
  values.forEach((value, index) => {
    const targetIndex = index + roundedOffset;
    if (targetIndex >= 0 && targetIndex < shifted.length) {
      shifted[targetIndex] = Math.max(0, Math.min(values.length - 1, value + roundedOffset));
    }
  });
  return shifted;
}

function normalizeBandMultipliers(value: VwapOptions['bandMultipliers']): [number, number, number] {
  const source = Array.isArray(value) ? value : [1, 2, 3];
  return [0, 1, 2].map((index) => {
    const next = Number(source[index]);
    return Number.isFinite(next) ? Math.max(0, next) : index + 1;
  }) as [number, number, number];
}

export function calculateVwapWithBands(candles: IndicatorCandle[], options: VwapOptions = {}): VwapResult {
  const anchorPeriod = VWAP_ANCHOR_PERIODS.has(options.anchorPeriod as VwapAnchorPeriod)
    ? options.anchorPeriod as VwapAnchorPeriod
    : 'session';
  const source = VWAP_SOURCES.has(options.source as VwapSource) ? options.source as VwapSource : 'hlc3';
  const offset = Number.isFinite(Number(options.offset)) ? Math.trunc(Number(options.offset)) : 0;
  const bandMode = options.bandMode === 'percentage' ? 'percentage' : 'standard-deviation';
  const bandMultipliers = normalizeBandMultipliers(options.bandMultipliers);
  const sessionTimezone = String(options.sessionTimezone || 'UTC');
  const customBars = Math.max(1, Math.floor(Number(options.customBars) || 1));
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  let cumulativeSquarePriceVolume = 0;
  let previousAnchorKey: string | null = null;
  const rollingPriceVolumes: number[] = [];
  const rollingSquarePriceVolumes: number[] = [];
  const rollingVolumes: number[] = [];
  const upper: VwapBands['upper'] = [[], [], []];
  const lower: VwapBands['lower'] = [[], [], []];
  const anchorStarts: number[] = [];
  let currentAnchorStart = 0;
  const values = candles.map((candle, candleIndex) => {
    const price = getSourcePrice(candle, source);
    const priceVolume = price * candle.volume;
    const squarePriceVolume = price * price * candle.volume;
    if (anchorPeriod === 'custom') {
      currentAnchorStart = Math.max(0, candleIndex - customBars + 1);
      rollingPriceVolumes.push(priceVolume);
      rollingSquarePriceVolumes.push(squarePriceVolume);
      rollingVolumes.push(candle.volume);
      cumulativePriceVolume += priceVolume;
      cumulativeSquarePriceVolume += squarePriceVolume;
      cumulativeVolume += candle.volume;
      if (rollingPriceVolumes.length > customBars) {
        cumulativePriceVolume -= rollingPriceVolumes.shift() ?? 0;
        cumulativeSquarePriceVolume -= rollingSquarePriceVolumes.shift() ?? 0;
        cumulativeVolume -= rollingVolumes.shift() ?? 0;
      }
    } else {
      const anchorKey = getAnchorKey(candle, anchorPeriod, sessionTimezone);
      if (anchorKey != null && previousAnchorKey != null && anchorKey !== previousAnchorKey) {
        cumulativePriceVolume = 0;
        cumulativeSquarePriceVolume = 0;
        cumulativeVolume = 0;
        currentAnchorStart = candleIndex;
      }
      if (anchorKey != null) previousAnchorKey = anchorKey;
      cumulativePriceVolume += priceVolume;
      cumulativeSquarePriceVolume += squarePriceVolume;
      cumulativeVolume += candle.volume;
    }
    if (cumulativeVolume === 0) {
      upper.forEach((series, index) => {
        series.push(null);
        lower[index].push(null);
      });
      anchorStarts.push(currentAnchorStart);
      return null;
    }
    const vwap = cumulativePriceVolume / cumulativeVolume;
    const variance = Math.max(0, (cumulativeSquarePriceVolume / cumulativeVolume) - (vwap * vwap));
    const standardDeviation = Math.sqrt(variance);
    bandMultipliers.forEach((multiplier, index) => {
      const distance = bandMode === 'percentage'
        ? vwap * (multiplier / 100)
        : standardDeviation * multiplier;
      upper[index].push(vwap + distance);
      lower[index].push(vwap - distance);
    });
    anchorStarts.push(currentAnchorStart);
    return vwap;
  });
  return {
    vwap: applyOffset(values, offset),
    anchorStarts: applyAnchorStartOffset(anchorStarts, offset),
    bands: {
      upper: upper.map((series) => applyOffset(series, offset)) as VwapBands['upper'],
      lower: lower.map((series) => applyOffset(series, offset)) as VwapBands['lower'],
    },
  };
}

export function calculateVwap(candles: IndicatorCandle[], options: VwapOptions = {}): NullableSeries {
  return calculateVwapWithBands(candles, options).vwap;
}
