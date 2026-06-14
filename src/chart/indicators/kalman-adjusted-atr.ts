import { calculateAtr } from './atr.ts';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export type KalmanAdjustedAtrMaType = 'sma' | 'ema' | 'wma' | 'rma' | 'dema' | 'hma' | 'linreg' | 'alma';
export type KalmanAdjustedAtrSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export interface KalmanAdjustedAtrOptions {
  source?: KalmanAdjustedAtrSource;
  processNoise?: number;
  measurementNoise?: number;
  filterOrder?: number;
  atrPeriod?: number;
  factor?: number;
  maType?: KalmanAdjustedAtrMaType;
  maPeriod?: number;
  almaSigma?: number;
  confirmBars?: number;
}

export interface KalmanAdjustedAtrResult {
  baseline: NullableSeries;
  ma: NullableSeries;
  atr: NullableSeries;
  trend: Array<1 | -1 | 0>;
  trendUp: boolean[];
  trendDown: boolean[];
}

const DEFAULT_OPTIONS: Required<KalmanAdjustedAtrOptions> = {
  source: 'close',
  processNoise: 0.01,
  measurementNoise: 3,
  filterOrder: 5,
  atrPeriod: 5,
  factor: 0.5,
  maType: 'ema',
  maPeriod: 50,
  almaSigma: 0.7,
  confirmBars: 1,
};

function emptyResult(length: number): KalmanAdjustedAtrResult {
  return {
    baseline: new Array(length).fill(null),
    ma: new Array(length).fill(null),
    atr: new Array(length).fill(null),
    trend: new Array(length).fill(0),
    trendUp: new Array(length).fill(false),
    trendDown: new Array(length).fill(false),
  };
}

function getSourceValue(candle: IndicatorCandle, source: KalmanAdjustedAtrSource): number {
  if (source === 'open') return candle.open;
  if (source === 'high') return candle.high;
  if (source === 'low') return candle.low;
  if (source === 'hl2') return (candle.high + candle.low) / 2;
  if (source === 'hlc3') return (candle.high + candle.low + candle.close) / 3;
  if (source === 'ohlc4') return (candle.open + candle.high + candle.low + candle.close) / 4;
  return candle.close;
}

function finiteOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptions(options: KalmanAdjustedAtrOptions): Required<KalmanAdjustedAtrOptions> {
  const source = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'].includes(String(options.source))
    ? options.source as KalmanAdjustedAtrSource
    : DEFAULT_OPTIONS.source;
  const maType = ['sma', 'ema', 'wma', 'rma', 'dema', 'hma', 'linreg', 'alma'].includes(String(options.maType))
    ? options.maType as KalmanAdjustedAtrMaType
    : DEFAULT_OPTIONS.maType;

  return {
    source,
    maType,
    processNoise: Math.max(0.000001, finiteOr(options.processNoise, DEFAULT_OPTIONS.processNoise)),
    measurementNoise: Math.max(0.000001, finiteOr(options.measurementNoise, DEFAULT_OPTIONS.measurementNoise)),
    filterOrder: Math.max(1, Math.min(20, Math.floor(finiteOr(options.filterOrder, DEFAULT_OPTIONS.filterOrder)))),
    atrPeriod: Math.max(1, Math.min(500, Math.floor(finiteOr(options.atrPeriod, DEFAULT_OPTIONS.atrPeriod)))),
    factor: Math.max(0.000001, finiteOr(options.factor, DEFAULT_OPTIONS.factor)),
    maPeriod: Math.max(1, Math.min(500, Math.floor(finiteOr(options.maPeriod, DEFAULT_OPTIONS.maPeriod)))),
    almaSigma: Math.max(0.000001, finiteOr(options.almaSigma, DEFAULT_OPTIONS.almaSigma)),
    confirmBars: Math.max(1, Math.min(20, Math.floor(finiteOr(options.confirmBars, DEFAULT_OPTIONS.confirmBars)))),
  };
}

export function applyKalmanAdjustedAtrTrendConfirmation(
  baseline: NullableSeries,
  confirmBars = 1,
): Pick<KalmanAdjustedAtrResult, 'trend' | 'trendUp' | 'trendDown'> {
  const requiredBars = Math.max(1, Math.min(20, Math.floor(finiteOr(confirmBars, 1))));
  const trend: Array<1 | -1 | 0> = new Array(baseline.length).fill(0);
  const trendUp = new Array(baseline.length).fill(false);
  const trendDown = new Array(baseline.length).fill(false);
  let confirmedTrend: 1 | -1 | 0 = 0;
  let candidateTrend: 1 | -1 | 0 = 0;
  let candidateCount = 0;

  for (let i = 1; i < baseline.length; i += 1) {
    const current = baseline[i];
    const previous = baseline[i - 1];
    if (current == null || previous == null) {
      trend[i] = confirmedTrend;
      continue;
    }

    const slope = current - previous;
    const rawTrend: 1 | -1 | 0 = slope > 0 ? 1 : slope < 0 ? -1 : confirmedTrend;
    if (rawTrend === 0) {
      trend[i] = confirmedTrend;
      continue;
    }

    if (rawTrend === confirmedTrend) {
      candidateTrend = 0;
      candidateCount = 0;
      trend[i] = confirmedTrend;
      continue;
    }

    if (rawTrend === candidateTrend) {
      candidateCount += 1;
    } else {
      candidateTrend = rawTrend;
      candidateCount = 1;
    }

    if (candidateCount >= requiredBars) {
      const previousConfirmed = confirmedTrend;
      confirmedTrend = rawTrend;
      candidateTrend = 0;
      candidateCount = 0;
      trendUp[i] = confirmedTrend === 1 && previousConfirmed !== 1;
      trendDown[i] = confirmedTrend === -1 && previousConfirmed !== -1;
    }
    trend[i] = confirmedTrend;
  }

  return { trend, trendUp, trendDown };
}

function calculateKalmanSeries(values: number[], processNoise: number, measurementNoise: number, order: number): NullableSeries {
  const states = new Array(order).fill(values[0] ?? 0);
  const errors = new Array(order).fill(1);
  const out: NullableSeries = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i += 1) {
    for (let depth = 0; depth < order; depth += 1) {
      const predictedError = errors[depth] + processNoise;
      const gain = predictedError / (predictedError + measurementNoise);
      states[depth] = states[depth] + gain * (values[i] - states[depth]);
      errors[depth] = (1 - gain) * predictedError;
    }
    out[i] = states[0];
  }

  return out;
}

function sma(values: NullableSeries, period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1);
    if (window.some((value) => value == null)) continue;
    out[i] = (window as number[]).reduce((sum, value) => sum + value, 0) / period;
  }
  return out;
}

function ema(values: NullableSeries, period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  const alpha = 2 / (period + 1);
  let previous: number | null = null;
  const seed: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) continue;
    if (previous == null) {
      seed.push(value);
      if (seed.length < period) continue;
      previous = seed.slice(seed.length - period).reduce((sum, item) => sum + item, 0) / period;
    } else {
      previous = value * alpha + previous * (1 - alpha);
    }
    out[i] = previous;
  }
  return out;
}

function rma(values: NullableSeries, period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  let previous: number | null = null;
  for (let i = period - 1; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) continue;
    if (previous == null) {
      const window = values.slice(i - period + 1, i + 1);
      if (window.some((item) => item == null)) continue;
      previous = (window as number[]).reduce((sum, item) => sum + item, 0) / period;
    } else {
      previous = (previous * (period - 1) + value) / period;
    }
    out[i] = previous;
  }
  return out;
}

function wma(values: NullableSeries, period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  const denominator = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i += 1) {
    let weighted = 0;
    let valid = true;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[i - period + 1 + offset];
      if (value == null) {
        valid = false;
        break;
      }
      weighted += value * (offset + 1);
    }
    if (valid) out[i] = weighted / denominator;
  }
  return out;
}

function hma(values: NullableSeries, period: number): NullableSeries {
  const half = Math.max(1, Math.floor(period / 2));
  const root = Math.max(1, Math.round(Math.sqrt(period)));
  const halfWma = wma(values, half);
  const fullWma = wma(values, period);
  const diff = values.map((_, index) => {
    const fast = halfWma[index];
    const slow = fullWma[index];
    return fast == null || slow == null ? null : fast * 2 - slow;
  });
  return wma(diff, root);
}

function linreg(values: NullableSeries, period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  const xMean = (period - 1) / 2;
  const xVariance = Array.from({ length: period }, (_, index) => (index - xMean) ** 2).reduce((sum, value) => sum + value, 0);
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1);
    if (window.some((value) => value == null)) continue;
    const yMean = (window as number[]).reduce((sum, value) => sum + value, 0) / period;
    const covariance = (window as number[]).reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
    const slope = xVariance === 0 ? 0 : covariance / xVariance;
    out[i] = yMean + slope * xMean;
  }
  return out;
}

function alma(values: NullableSeries, period: number, sigma: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  const offset = 0.85;
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights = Array.from({ length: period }, (_, index) => Math.exp(-((index - m) ** 2) / (2 * s * s)));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  for (let i = period - 1; i < values.length; i += 1) {
    let acc = 0;
    let valid = true;
    for (let offsetIndex = 0; offsetIndex < period; offsetIndex += 1) {
      const value = values[i - period + 1 + offsetIndex];
      if (value == null) {
        valid = false;
        break;
      }
      acc += value * weights[offsetIndex];
    }
    if (valid) out[i] = acc / weightSum;
  }
  return out;
}

function calculateMa(values: NullableSeries, type: KalmanAdjustedAtrMaType, period: number, almaSigma: number): NullableSeries {
  if (type === 'sma') return sma(values, period);
  if (type === 'wma') return wma(values, period);
  if (type === 'rma') return rma(values, period);
  if (type === 'dema') {
    const first = ema(values, period);
    const second = ema(first, period);
    return first.map((value, index) => (value == null || second[index] == null ? null : value * 2 - second[index]!));
  }
  if (type === 'hma') return hma(values, period);
  if (type === 'linreg') return linreg(values, period);
  if (type === 'alma') return alma(values, period, almaSigma);
  return ema(values, period);
}

export function calculateKalmanAdjustedAtr(
  candles: IndicatorCandle[],
  options: KalmanAdjustedAtrOptions = {},
): KalmanAdjustedAtrResult {
  if (!candles.length) return emptyResult(0);

  const config = normalizeOptions(options);
  const source = candles.map((candle) => getSourceValue(candle, config.source));
  const kalman = calculateKalmanSeries(source, config.processNoise, config.measurementNoise, config.filterOrder);
  const atr = calculateAtr(candles, config.atrPeriod);
  const baseline: NullableSeries = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i += 1) {
    const estimate = kalman[i];
    if (estimate == null) continue;
    if (i === 0 || baseline[i - 1] == null || atr[i] == null) {
      baseline[i] = estimate;
    } else {
      const step = Math.max(0, atr[i]! * config.factor);
      const previous = baseline[i - 1]!;
      const upper = estimate + step;
      const lower = estimate - step;
      baseline[i] = lower > previous ? lower : upper < previous ? upper : previous;
    }

  }
  const confirmed = applyKalmanAdjustedAtrTrendConfirmation(baseline, config.confirmBars);

  return {
    baseline,
    ma: calculateMa(baseline, config.maType, config.maPeriod, config.almaSigma),
    atr,
    trend: confirmed.trend,
    trendUp: confirmed.trendUp,
    trendDown: confirmed.trendDown,
  };
}
