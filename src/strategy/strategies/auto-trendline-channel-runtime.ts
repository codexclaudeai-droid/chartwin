export type AutoTrendlineChannelTrend = 'bullish' | 'bearish' | 'neutral';

export interface AutoTrendlineChannelCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AutoTrendlineChannelConfig {
  channelLength: number;
  widthMultiplier: number;
  rrRatio: number;
  useLong: boolean;
  useShort: boolean;
}

export interface AutoTrendlineChannelResult {
  upper: Array<number | null>;
  basis: Array<number | null>;
  lower: Array<number | null>;
  trend: AutoTrendlineChannelTrend[];
}

export interface AutoTrendlineChannelStrategyResult {
  signals: Array<-1 | 0 | 1>;
  channel: AutoTrendlineChannelResult;
  stopLoss: Array<number | null>;
  takeProfit: Array<number | null>;
}

const DEFAULT_CONFIG: AutoTrendlineChannelConfig = {
  channelLength: 20,
  widthMultiplier: 1.5,
  rrRatio: 1.5,
  useLong: true,
  useShort: true,
};

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveAutoTrendlineChannelConfig(input: Partial<AutoTrendlineChannelConfig> = {}): AutoTrendlineChannelConfig {
  return {
    channelLength: Math.max(5, Math.floor(finiteNumber(input.channelLength, DEFAULT_CONFIG.channelLength))),
    widthMultiplier: Math.max(0.5, finiteNumber(input.widthMultiplier, DEFAULT_CONFIG.widthMultiplier)),
    rrRatio: Math.max(0.5, finiteNumber(input.rrRatio, DEFAULT_CONFIG.rrRatio)),
    useLong: input.useLong !== false,
    useShort: input.useShort !== false,
  };
}

function linregAt(values: number[], period: number, index: number): number | null {
  if (period <= 1 || index < period - 1) return null;
  const start = index - period + 1;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let j = 0; j < period; j += 1) {
    const y = values[start + j];
    if (!Number.isFinite(y)) return null;
    sumX += j;
    sumY += y;
    sumXY += j * y;
    sumXX += j * j;
  }
  const denom = period * sumXX - sumX * sumX;
  if (Math.abs(denom) < Number.EPSILON) return null;
  const slope = (period * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / period;
  return intercept + slope * (period - 1);
}

function stdevAt(values: number[], period: number, index: number): number | null {
  if (period <= 0 || index < period - 1) return null;
  const start = index - period + 1;
  let sum = 0;
  for (let j = start; j <= index; j += 1) {
    const value = values[j];
    if (!Number.isFinite(value)) return null;
    sum += value;
  }
  const mean = sum / period;
  let variance = 0;
  for (let j = start; j <= index; j += 1) {
    const diff = values[j] - mean;
    variance += diff * diff;
  }
  return Math.sqrt(variance / period);
}

function crossedOver(prevA: number | null, currentA: number, prevB: number | null, currentB: number | null): boolean {
  return prevA != null && prevB != null && currentB != null && prevA <= prevB && currentA > currentB;
}

function crossedUnder(prevA: number | null, currentA: number, prevB: number | null, currentB: number | null): boolean {
  return prevA != null && prevB != null && currentB != null && prevA >= prevB && currentA < currentB;
}

function confirmedPivotLow(candles: AutoTrendlineChannelCandle[], center: number, span: number): number | null {
  if (center - span < 0 || center + span >= candles.length) return null;
  const value = candles[center].low;
  for (let i = center - span; i <= center + span; i += 1) {
    if (i !== center && candles[i].low <= value) return null;
  }
  return value;
}

function confirmedPivotHigh(candles: AutoTrendlineChannelCandle[], center: number, span: number): number | null {
  if (center - span < 0 || center + span >= candles.length) return null;
  const value = candles[center].high;
  for (let i = center - span; i <= center + span; i += 1) {
    if (i !== center && candles[i].high >= value) return null;
  }
  return value;
}

export function calculateAutoTrendlineChannel(
  candles: AutoTrendlineChannelCandle[],
  input: Partial<AutoTrendlineChannelConfig> = {},
): AutoTrendlineChannelResult {
  const config = resolveAutoTrendlineChannelConfig(input);
  const close = candles.map((candle) => Number(candle.close));
  const period = config.channelLength * 2;
  const upper = new Array<number | null>(candles.length).fill(null);
  const basis = new Array<number | null>(candles.length).fill(null);
  const lower = new Array<number | null>(candles.length).fill(null);
  const trend = new Array<AutoTrendlineChannelTrend>(candles.length).fill('neutral');

  for (let i = 0; i < candles.length; i += 1) {
    const basisNow = linregAt(close, period, i);
    const devNow = stdevAt(close, period, i);
    if (basisNow == null || devNow == null) continue;
    const dev = devNow * config.widthMultiplier;
    basis[i] = basisNow;
    upper[i] = basisNow + dev;
    lower[i] = basisNow - dev;
    const basisPrev = basis[i - 1];
    if (basisPrev != null && basisNow > basisPrev && close[i] > basisNow) trend[i] = 'bullish';
    else if (basisPrev != null && basisNow < basisPrev && close[i] < basisNow) trend[i] = 'bearish';
  }

  return { upper, basis, lower, trend };
}

export function simulateAutoTrendlineChannelStrategy(
  candles: AutoTrendlineChannelCandle[],
  input: Partial<AutoTrendlineChannelConfig> = {},
): AutoTrendlineChannelStrategyResult {
  const config = resolveAutoTrendlineChannelConfig(input);
  const channel = calculateAutoTrendlineChannel(candles, config);
  const signals = new Array<-1 | 0 | 1>(candles.length).fill(0);
  const stopLoss = new Array<number | null>(candles.length).fill(null);
  const takeProfit = new Array<number | null>(candles.length).fill(null);
  let position: 'long' | 'short' | null = null;
  let stop: number | null = null;
  let target: number | null = null;
  let lastPivotLow: number | null = null;
  let lastPivotHigh: number | null = null;

  for (let i = 1; i < candles.length; i += 1) {
    const confirmedCenter = i - config.channelLength;
    if (confirmedCenter >= 0) {
      lastPivotLow = confirmedPivotLow(candles, confirmedCenter, config.channelLength) ?? lastPivotLow;
      lastPivotHigh = confirmedPivotHigh(candles, confirmedCenter, config.channelLength) ?? lastPivotHigh;
    }

    const candle = candles[i];
    const prevClose = candles[i - 1].close;
    const close = candle.close;
    const lowerNow = channel.lower[i];
    const lowerPrev = channel.lower[i - 1];
    const basisNow = channel.basis[i];
    const basisPrev = channel.basis[i - 1];
    const upperNow = channel.upper[i];
    const upperPrev = channel.upper[i - 1];

    if (position === 'long' && stop != null && target != null) {
      if (candle.low <= stop || candle.high >= target || crossedUnder(prevClose, close, lowerPrev, lowerNow)) {
        position = null;
        stop = null;
        target = null;
      }
    } else if (position === 'short' && stop != null && target != null) {
      if (candle.high >= stop || candle.low <= target || crossedOver(prevClose, close, upperPrev, upperNow)) {
        position = null;
        stop = null;
        target = null;
      }
    }

    if (position != null) continue;

    const longCondition = channel.trend[i] === 'bullish'
      && (crossedOver(prevClose, close, lowerPrev, lowerNow) || crossedOver(prevClose, close, basisPrev, basisNow));
    if (longCondition && config.useLong) {
      const fallback = candles[i - 1]?.low;
      const entryStop = (lastPivotLow != null && lastPivotLow < close) ? lastPivotLow : fallback;
      if (Number.isFinite(entryStop) && entryStop < close) {
        const risk = close - entryStop;
        position = 'long';
        stop = entryStop;
        target = close + risk * config.rrRatio;
        signals[i] = 1;
        stopLoss[i] = stop;
        takeProfit[i] = target;
      }
      continue;
    }

    const shortCondition = channel.trend[i] === 'bearish'
      && (crossedUnder(prevClose, close, basisPrev, basisNow) || crossedUnder(prevClose, close, upperPrev, upperNow));
    if (shortCondition && config.useShort) {
      const fallback = candles[i - 1]?.high;
      const entryStop = (lastPivotHigh != null && lastPivotHigh > close) ? lastPivotHigh : fallback;
      if (Number.isFinite(entryStop) && entryStop > close) {
        const risk = entryStop - close;
        position = 'short';
        stop = entryStop;
        target = close - risk * config.rrRatio;
        signals[i] = -1;
        stopLoss[i] = stop;
        takeProfit[i] = target;
      }
    }
  }

  return { signals, channel, stopLoss, takeProfit };
}
