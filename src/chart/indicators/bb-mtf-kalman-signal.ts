import type { IndicatorCandle, NullableSeries } from './types.ts';

export type BbMtfKalmanColorOption = 'Gradient' | 'Solid' | 'None';

export interface BbMtfKalmanSignalOptions {
  chartTimeframe?: string;
  htfTimeframe?: string;
  ltfLength?: number;
  ltfMult?: number;
  htfLength?: number;
  htfMult?: number;
  minOpacity?: number;
  maxOpacity?: number;
  colorOption?: BbMtfKalmanColorOption;
}

export interface BbMtfKalmanSignalResult {
  ltfBasis: NullableSeries;
  ltfUpper: NullableSeries;
  ltfLower: NullableSeries;
  htfBasis: NullableSeries;
  htfUpper: NullableSeries;
  htfLower: NullableSeries;
  htfRawBasis: NullableSeries;
  htfRawUpper: NullableSeries;
  htfRawLower: NullableSeries;
  buySignal: boolean[];
  sellSignal: boolean[];
  upperFillOpacity: NullableSeries;
  lowerFillOpacity: NullableSeries;
  htfCandleStartIndex: number[];
  warning: string | null;
}

interface HtfCandle {
  startTime: number;
  startIndex: number;
  endIndex: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

const TIMEFRAME_SECONDS_BY_KEY: Record<string, number> = {
  '1s': 1,
  '5s': 5,
  '10s': 10,
  '15s': 15,
  '30s': 30,
  '45s': 45,
  '1m': 60,
  '2m': 120,
  '3m': 180,
  '5m': 300,
  '10m': 600,
  '15m': 900,
  '30m': 1800,
  '45m': 2700,
  '1h': 3600,
  '2h': 7200,
  '3h': 10800,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
};

export function parseIndicatorTimeframeSeconds(timeframe: string | undefined): number | null {
  const raw = String(timeframe ?? '').trim();
  if (!raw) return null;
  if (TIMEFRAME_SECONDS_BY_KEY[raw]) return TIMEFRAME_SECONDS_BY_KEY[raw];
  if (/^\d+$/.test(raw)) return Number(raw) * 60;
  const match = raw.match(/^(\d+)([smhdwM])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 3600;
  if (unit === 'd') return value * 86400;
  if (unit === 'w') return value * 604800;
  if (unit === 'M') return value * 2592000;
  return null;
}

function emptyResult(length: number, warning: string | null): BbMtfKalmanSignalResult {
  return {
    ltfBasis: new Array(length).fill(null),
    ltfUpper: new Array(length).fill(null),
    ltfLower: new Array(length).fill(null),
    htfBasis: new Array(length).fill(null),
    htfUpper: new Array(length).fill(null),
    htfLower: new Array(length).fill(null),
    htfRawBasis: new Array(length).fill(null),
    htfRawUpper: new Array(length).fill(null),
    htfRawLower: new Array(length).fill(null),
    buySignal: new Array(length).fill(false),
    sellSignal: new Array(length).fill(false),
    upperFillOpacity: new Array(length).fill(null),
    lowerFillOpacity: new Array(length).fill(null),
    htfCandleStartIndex: new Array(length).fill(-1),
    warning,
  };
}

function aggregateHtfCandles(candles: IndicatorCandle[], chartSeconds: number, htfSeconds: number): {
  htfCandles: HtfCandle[];
  startIndexByBar: number[];
} {
  const htfCandles: HtfCandle[] = [];
  const startIndexByBar = new Array(candles.length).fill(-1);
  const expectedBars = Math.max(1, Math.round(htfSeconds / chartSeconds));
  let current: HtfCandle | null = null;
  let currentBucket = Number.NaN;

  candles.forEach((candle, index) => {
    const time = Number(candle.time ?? index * chartSeconds);
    const bucketStart = Math.floor(time / htfSeconds) * htfSeconds;
    if (!current || bucketStart !== currentBucket) {
      if (current) htfCandles.push(current);
      currentBucket = bucketStart;
      current = {
        startTime: bucketStart,
        startIndex: index,
        endIndex: index,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        complete: false,
      };
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
      current.endIndex = index;
    }
    startIndexByBar[index] = current.startIndex;
  });
  if (current) htfCandles.push(current);

  htfCandles.forEach((htf, index) => {
    const hasNextBucket = index < htfCandles.length - 1;
    const observedBars = htf.endIndex - htf.startIndex + 1;
    htf.complete = hasNextBucket || observedBars >= expectedBars;
  });

  return { htfCandles, startIndexByBar };
}

function calculatePopulationStdev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

function calculateBollingerFromValues(values: number[], length: number, mult: number): {
  basis: NullableSeries;
  upper: NullableSeries;
  lower: NullableSeries;
} {
  const basis: NullableSeries = new Array(values.length).fill(null);
  const upper: NullableSeries = new Array(values.length).fill(null);
  const lower: NullableSeries = new Array(values.length).fill(null);
  for (let i = length - 1; i < values.length; i += 1) {
    const window = values.slice(i - length + 1, i + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / length;
    const dev = calculatePopulationStdev(window) * mult;
    basis[i] = mean;
    upper[i] = mean + dev;
    lower[i] = mean - dev;
  }
  return { basis, upper, lower };
}

function calculateEmaFromNullable(values: NullableSeries, length: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  const k = 2 / (length + 1);
  let buffer: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) {
      out[i] = null;
      continue;
    }
    if (prev == null) {
      buffer.push(value);
      if (buffer.length < length) continue;
      if (buffer.length > length) buffer = buffer.slice(buffer.length - length);
      prev = buffer.reduce((sum, item) => sum + item, 0) / length;
      out[i] = prev;
      continue;
    }
    prev = value * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function calculateKalmanBasis(closes: number[]): NullableSeries {
  const out: NullableSeries = new Array(closes.length).fill(null);
  const processNoise = 0.2;
  const measurementError = 2;
  let estimate: number | null = null;
  let errorEstimate = 1;
  for (let i = 0; i < closes.length; i += 1) {
    if (estimate == null) {
      estimate = i > 0 ? closes[i - 1] : null;
    }
    const kalmanGain = errorEstimate / (errorEstimate + measurementError);
    if (estimate != null) {
      const prediction = estimate;
      estimate = prediction + kalmanGain * (closes[i] - prediction);
      out[i] = estimate;
    }
    errorEstimate = (1 - kalmanGain) * errorEstimate + processNoise;
  }
  return out;
}

function mapConfirmedHtfSeriesToChartBars(
  length: number,
  htfCandles: HtfCandle[],
  htfSeries: NullableSeries,
): NullableSeries {
  const out: NullableSeries = new Array(length).fill(null);
  let lastConfirmed: number | null = null;
  let htfIndex = 0;
  for (let i = 0; i < length; i += 1) {
    while (htfIndex < htfCandles.length) {
      const htf = htfCandles[htfIndex];
      if (i < htf.endIndex) break;
      if (i === htf.endIndex && htf.complete) {
        const next = htfSeries[htfIndex];
        if (next != null) lastConfirmed = next;
      }
      if (i < htf.endIndex + 1) break;
      htfIndex += 1;
    }
    out[i] = lastConfirmed;
    if (htfIndex < htfCandles.length && i >= htfCandles[htfIndex].endIndex) {
      htfIndex += 1;
    }
  }
  return out;
}

function calculateFillOpacity(
  candles: IndicatorCandle[],
  side: 'buy' | 'sell',
  minOpacity: number,
  maxOpacity: number,
): NullableSeries {
  const pct = candles.map((candle) => {
    const range = candle.high - candle.low;
    if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(candle.volume) || candle.volume <= 0) return 0.5;
    if (side === 'buy') return Math.max(0, Math.min(1, (candle.close - candle.low) / range));
    return Math.max(0, Math.min(1, (candle.high - candle.close) / range));
  });
  const smoothed = calculateEmaFromNullable(pct, 2);
  return smoothed.map((value) => {
    if (value == null) return null;
    return value * (maxOpacity - minOpacity) + minOpacity;
  });
}

export function calculateBbMtfKalmanSignal(
  candles: IndicatorCandle[],
  options: BbMtfKalmanSignalOptions = {},
): BbMtfKalmanSignalResult {
  const length = candles.length;
  const chartSeconds = parseIndicatorTimeframeSeconds(options.chartTimeframe ?? '1h');
  const htfSeconds = parseIndicatorTimeframeSeconds(options.htfTimeframe ?? '4h');
  if (!chartSeconds || !htfSeconds) return emptyResult(length, 'Invalid timeframe');
  if (htfSeconds <= chartSeconds) return emptyResult(length, 'HTF timeframe must be higher than chart timeframe');

  const ltfLength = Math.max(1, Math.floor(Number(options.ltfLength ?? 20) || 20));
  const htfLength = Math.max(1, Math.floor(Number(options.htfLength ?? 20) || 20));
  const ltfMult = Math.max(0.1, Number(options.ltfMult ?? 2) || 2);
  const htfMult = Math.max(0.1, Number(options.htfMult ?? 2.25) || 2.25);
  const minOpacity = Math.max(0, Math.min(100, Number(options.minOpacity ?? 55) || 55));
  const maxOpacity = Math.max(minOpacity, Math.min(100, Number(options.maxOpacity ?? 99) || 99));
  const colorOption: BbMtfKalmanColorOption = options.colorOption === 'Solid' || options.colorOption === 'None'
    ? options.colorOption
    : 'Gradient';
  const closes = candles.map((candle) => candle.close);

  const { htfCandles, startIndexByBar } = aggregateHtfCandles(candles, chartSeconds, htfSeconds);
  const htfBb = calculateBollingerFromValues(htfCandles.map((candle) => candle.close), htfLength, htfMult);
  const htfRawBasis = mapConfirmedHtfSeriesToChartBars(length, htfCandles, htfBb.basis);
  const htfRawUpper = mapConfirmedHtfSeriesToChartBars(length, htfCandles, htfBb.upper);
  const htfRawLower = mapConfirmedHtfSeriesToChartBars(length, htfCandles, htfBb.lower);
  const htfBasis = calculateEmaFromNullable(htfRawBasis, htfLength);
  const htfUpper = calculateEmaFromNullable(htfRawUpper, htfLength);
  const htfLower = calculateEmaFromNullable(htfRawLower, htfLength);

  const ltfBasis = calculateKalmanBasis(closes);
  const ltfUpper: NullableSeries = new Array(length).fill(null);
  const ltfLower: NullableSeries = new Array(length).fill(null);
  for (let i = ltfLength - 1; i < length; i += 1) {
    const basis = ltfBasis[i];
    if (basis == null) continue;
    const dev = calculatePopulationStdev(closes.slice(i - ltfLength + 1, i + 1)) * ltfMult;
    ltfUpper[i] = basis + dev;
    ltfLower[i] = basis - dev;
  }

  const buySignal: boolean[] = new Array(length).fill(false);
  const sellSignal: boolean[] = new Array(length).fill(false);
  let crossedAbove = false;
  let crossedBelow = false;
  let bearSignaled = false;
  let bullSignaled = false;
  for (let i = 0; i < length; i += 1) {
    const close = closes[i];
    const upper = htfUpper[i];
    const lower = htfLower[i];
    if (upper != null && close > upper) crossedAbove = true;
    if (lower != null && close < lower) crossedBelow = true;

    const ltfUpperValue = ltfUpper[i];
    const prevLtfUpperValue = i > 0 ? ltfUpper[i - 1] : null;
    const ltfLowerValue = ltfLower[i];
    const prevLtfLowerValue = i > 0 ? ltfLower[i - 1] : null;
    if (crossedAbove && ltfUpperValue != null && prevLtfUpperValue != null && ltfUpperValue < prevLtfUpperValue && !bearSignaled) {
      sellSignal[i] = true;
      bearSignaled = true;
    }
    if (crossedBelow && ltfLowerValue != null && prevLtfLowerValue != null && ltfLowerValue > prevLtfLowerValue && !bullSignaled) {
      buySignal[i] = true;
      bullSignaled = true;
    }

    if (ltfUpperValue != null && upper != null && close < ltfUpperValue && close < upper) {
      crossedAbove = false;
      bearSignaled = false;
    }
    if (ltfLowerValue != null && lower != null && close > ltfLowerValue && close > lower) {
      crossedBelow = false;
      bullSignaled = false;
    }
  }

  const buyOpacity = colorOption === 'Gradient' ? calculateFillOpacity(candles, 'buy', minOpacity, maxOpacity) : new Array(length).fill(50);
  const sellOpacity = colorOption === 'Gradient' ? calculateFillOpacity(candles, 'sell', minOpacity, maxOpacity) : new Array(length).fill(50);
  const upperFillOpacity: NullableSeries = new Array(length).fill(null);
  const lowerFillOpacity: NullableSeries = new Array(length).fill(null);
  if (colorOption !== 'None') {
    for (let i = 0; i < length; i += 1) {
      if (ltfUpper[i] != null && htfUpper[i] != null && ltfUpper[i]! > htfUpper[i]!) upperFillOpacity[i] = sellOpacity[i];
      if (ltfLower[i] != null && htfLower[i] != null && ltfLower[i]! < htfLower[i]!) lowerFillOpacity[i] = buyOpacity[i];
    }
  }

  return {
    ltfBasis,
    ltfUpper,
    ltfLower,
    htfBasis,
    htfUpper,
    htfLower,
    htfRawBasis,
    htfRawUpper,
    htfRawLower,
    buySignal,
    sellSignal,
    upperFillOpacity,
    lowerFillOpacity,
    htfCandleStartIndex: startIndexByBar,
    warning: null,
  };
}
