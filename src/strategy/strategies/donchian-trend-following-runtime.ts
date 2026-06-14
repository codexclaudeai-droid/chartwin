export interface DonchianTrendFollowingCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type DonchianTrendFollowingEntryMode = 'breakout' | 'pullback' | 'both';

export interface DonchianTrendFollowingConfig {
  entryMode: DonchianTrendFollowingEntryMode;
  entryPeriod: number;
  exitPeriod: number;
  atrPeriod: number;
  emaPeriod: number;
  trendLookback: number;
  minEfficiency: number;
  minChannelAtr: number;
  middleTouchToleranceAtr: number;
  setupExpireBars: number;
  stopAtrMultiplier: number;
  rrRatio: number;
  useLong: boolean;
  useShort: boolean;
}

interface DonchianPullbackSetup {
  side: 'long' | 'short';
  startedAt: number;
  middleTouched: boolean;
}

export interface DonchianTrendFollowingResult {
  signals: Array<-1 | 0 | 1>;
  upper: Array<number | null>;
  middle: Array<number | null>;
  lower: Array<number | null>;
  trendOk: boolean[];
  sideways: boolean[];
  stopLoss: Array<number | null>;
  takeProfit: Array<number | null>;
}

const DEFAULT_CONFIG: DonchianTrendFollowingConfig = {
  entryMode: 'both',
  entryPeriod: 20,
  exitPeriod: 10,
  atrPeriod: 14,
  emaPeriod: 50,
  trendLookback: 20,
  minEfficiency: 0.35,
  minChannelAtr: 1.4,
  middleTouchToleranceAtr: 0.15,
  setupExpireBars: 20,
  stopAtrMultiplier: 2,
  rrRatio: 2,
  useLong: true,
  useShort: true,
};

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeDonchianTrendEntryMode(
  value: unknown,
  fallback: DonchianTrendFollowingEntryMode = DEFAULT_CONFIG.entryMode,
): DonchianTrendFollowingEntryMode {
  const mode = String(value ?? fallback).toLowerCase();
  if (mode === 'breakout' || mode === 'pullback' || mode === 'both') return mode;
  return fallback;
}

export function resolveDonchianTrendFollowingConfig(
  input: Partial<DonchianTrendFollowingConfig> = {},
): DonchianTrendFollowingConfig {
  return {
    entryMode: normalizeDonchianTrendEntryMode(input.entryMode, DEFAULT_CONFIG.entryMode),
    entryPeriod: Math.max(2, Math.floor(finiteNumber(input.entryPeriod, DEFAULT_CONFIG.entryPeriod))),
    exitPeriod: Math.max(1, Math.floor(finiteNumber(input.exitPeriod, DEFAULT_CONFIG.exitPeriod))),
    atrPeriod: Math.max(1, Math.floor(finiteNumber(input.atrPeriod, DEFAULT_CONFIG.atrPeriod))),
    emaPeriod: Math.max(1, Math.floor(finiteNumber(input.emaPeriod, DEFAULT_CONFIG.emaPeriod))),
    trendLookback: Math.max(2, Math.floor(finiteNumber(input.trendLookback, DEFAULT_CONFIG.trendLookback))),
    minEfficiency: Math.max(0, Math.min(1, finiteNumber(input.minEfficiency, DEFAULT_CONFIG.minEfficiency))),
    minChannelAtr: Math.max(0, finiteNumber(input.minChannelAtr, DEFAULT_CONFIG.minChannelAtr)),
    middleTouchToleranceAtr: Math.max(0, finiteNumber(input.middleTouchToleranceAtr, DEFAULT_CONFIG.middleTouchToleranceAtr)),
    setupExpireBars: Math.max(1, Math.floor(finiteNumber(input.setupExpireBars, DEFAULT_CONFIG.setupExpireBars))),
    stopAtrMultiplier: Math.max(0.1, finiteNumber(input.stopAtrMultiplier, DEFAULT_CONFIG.stopAtrMultiplier)),
    rrRatio: Math.max(0.5, finiteNumber(input.rrRatio, DEFAULT_CONFIG.rrRatio)),
    useLong: input.useLong !== false,
    useShort: input.useShort !== false,
  };
}

export function calculateDonchianTrendFollowingChannel(
  candles: DonchianTrendFollowingCandle[],
  period: number,
): Pick<DonchianTrendFollowingResult, 'upper' | 'middle' | 'lower'> {
  const length = Math.max(2, Math.floor(Number(period) || DEFAULT_CONFIG.entryPeriod));
  const upper = new Array<number | null>(candles.length).fill(null);
  const middle = new Array<number | null>(candles.length).fill(null);
  const lower = new Array<number | null>(candles.length).fill(null);

  for (let i = length; i < candles.length; i += 1) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - length; j < i; j += 1) {
      const candle = candles[j];
      highest = Math.max(highest, Number(candle?.high));
      lowest = Math.min(lowest, Number(candle?.low));
    }
    if (!Number.isFinite(highest) || !Number.isFinite(lowest)) continue;
    upper[i] = highest;
    lower[i] = lowest;
    middle[i] = (highest + lowest) / 2;
  }

  return { upper, middle, lower };
}

export function calculateDonchianTrendAtrSeries(
  candles: DonchianTrendFollowingCandle[],
  period: number,
): Array<number | null> {
  const length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.atrPeriod));
  const trueRange = candles.map((candle, index) => {
    const high = Number(candle.high);
    const low = Number(candle.low);
    if (index === 0) return high - low;
    const previousClose = Number(candles[index - 1]?.close ?? candle.close);
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  });
  const atr = new Array<number | null>(candles.length).fill(null);
  let rolling = 0;
  for (let i = 0; i < trueRange.length; i += 1) {
    rolling += trueRange[i];
    if (i >= length) rolling -= trueRange[i - length];
    if (i >= length - 1) atr[i] = rolling / length;
  }
  return atr;
}

export function calculateDonchianTrendEmaSeries(values: number[], period: number): Array<number | null> {
  const length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.emaPeriod));
  const alpha = 2 / (length + 1);
  const ema = new Array<number | null>(values.length).fill(null);
  let current: number | null = null;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    current = current == null ? value : current + alpha * (value - current);
    ema[index] = current;
  });
  return ema;
}

export function calculateDonchianTrendEfficiency(values: number[], lookback: number, index: number): number | null {
  const length = Math.max(2, Math.floor(Number(lookback) || DEFAULT_CONFIG.trendLookback));
  if (index < length) return null;
  const start = index - length;
  const first = values[start];
  const last = values[index];
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  let path = 0;
  for (let i = start + 1; i <= index; i += 1) {
    const prev = values[i - 1];
    const current = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(current)) return null;
    path += Math.abs(current - prev);
  }
  if (path <= Number.EPSILON) return 0;
  return Math.abs(last - first) / path;
}

function previousLowestLow(candles: DonchianTrendFollowingCandle[], period: number, index: number): number | null {
  const length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.exitPeriod));
  if (index < length) return null;
  let lowest = Infinity;
  for (let i = index - length; i < index; i += 1) {
    lowest = Math.min(lowest, Number(candles[i]?.low));
  }
  return Number.isFinite(lowest) ? lowest : null;
}

function previousHighestHigh(candles: DonchianTrendFollowingCandle[], period: number, index: number): number | null {
  const length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.exitPeriod));
  if (index < length) return null;
  let highest = -Infinity;
  for (let i = index - length; i < index; i += 1) {
    highest = Math.max(highest, Number(candles[i]?.high));
  }
  return Number.isFinite(highest) ? highest : null;
}

export function createDonchianTrendTradePlan(
  side: 'long' | 'short',
  closeNow: number,
  upperNow: number,
  lowerNow: number,
  exitLower: number | null,
  exitUpper: number | null,
  atrNow: number,
  config: DonchianTrendFollowingConfig,
): { stopLoss: number; takeProfit: number } | null {
  if (side === 'long') {
    const channelStop = exitLower ?? lowerNow;
    const atrStop = closeNow - atrNow * config.stopAtrMultiplier;
    const stop = Math.max(Math.min(channelStop, closeNow - Number.EPSILON), atrStop);
    if (!Number.isFinite(stop) || stop >= closeNow) return null;
    const risk = closeNow - stop;
    return {
      stopLoss: stop,
      takeProfit: closeNow + risk * config.rrRatio,
    };
  }

  const channelStop = exitUpper ?? upperNow;
  const atrStop = closeNow + atrNow * config.stopAtrMultiplier;
  const stop = Math.min(Math.max(channelStop, closeNow + Number.EPSILON), atrStop);
  if (!Number.isFinite(stop) || stop <= closeNow) return null;
  const risk = stop - closeNow;
  return {
    stopLoss: stop,
    takeProfit: closeNow - risk * config.rrRatio,
  };
}

export function simulateDonchianTrendFollowingStrategy(
  candles: DonchianTrendFollowingCandle[],
  input: Partial<DonchianTrendFollowingConfig> = {},
): DonchianTrendFollowingResult {
  const config = resolveDonchianTrendFollowingConfig(input);
  const close = candles.map((candle) => Number(candle.close));
  const channel = calculateDonchianTrendFollowingChannel(candles, config.entryPeriod);
  const atr = calculateDonchianTrendAtrSeries(candles, config.atrPeriod);
  const ema = calculateDonchianTrendEmaSeries(close, config.emaPeriod);
  const signals = new Array<-1 | 0 | 1>(candles.length).fill(0);
  const trendOk = new Array<boolean>(candles.length).fill(false);
  const sideways = new Array<boolean>(candles.length).fill(true);
  const stopLoss = new Array<number | null>(candles.length).fill(null);
  const takeProfit = new Array<number | null>(candles.length).fill(null);

  let position: 'long' | 'short' | null = null;
  let activeStop: number | null = null;
  let activeTarget: number | null = null;
  let pullbackSetup: DonchianPullbackSetup | null = null;
  const allowsBreakoutEntry = config.entryMode === 'breakout' || config.entryMode === 'both';
  const allowsPullbackEntry = config.entryMode === 'pullback' || config.entryMode === 'both';

  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i];
    const closeNow = close[i];
    const upperNow = channel.upper[i];
    const middleNow = channel.middle[i];
    const lowerNow = channel.lower[i];
    const emaNow = ema[i];
    const emaPast = ema[i - config.trendLookback];
    const atrNow = atr[i];
    const efficiency = calculateDonchianTrendEfficiency(close, config.trendLookback, i);
    const channelWidth = upperNow != null && lowerNow != null ? upperNow - lowerNow : null;
    const widthAtr = channelWidth != null && atrNow != null && atrNow > 0 ? channelWidth / atrNow : null;
    const marketHasTrend = efficiency != null
      && widthAtr != null
      && efficiency >= config.minEfficiency
      && widthAtr >= config.minChannelAtr;
    sideways[i] = !marketHasTrend;
    const emaSlope = emaNow != null && emaPast != null ? emaNow - emaPast : null;
    const longTrend = marketHasTrend && emaSlope != null && emaSlope > 0 && emaNow != null && closeNow > emaNow;
    const shortTrend = marketHasTrend && emaSlope != null && emaSlope < 0 && emaNow != null && closeNow < emaNow;
    trendOk[i] = Boolean(longTrend || shortTrend);

    const exitLower = previousLowestLow(candles, config.exitPeriod, i);
    const exitUpper = previousHighestHigh(candles, config.exitPeriod, i);
    if (position === 'long') {
      if (
        (activeStop != null && candle.low <= activeStop)
        || (activeTarget != null && candle.high >= activeTarget)
        || (exitLower != null && closeNow < exitLower)
      ) {
        position = null;
        activeStop = null;
        activeTarget = null;
      }
    } else if (position === 'short') {
      if (
        (activeStop != null && candle.high >= activeStop)
        || (activeTarget != null && candle.low <= activeTarget)
        || (exitUpper != null && closeNow > exitUpper)
      ) {
        position = null;
        activeStop = null;
        activeTarget = null;
      }
    }

    if (position != null) {
      pullbackSetup = null;
      continue;
    }
    if (upperNow == null || middleNow == null || lowerNow == null || atrNow == null) continue;

    const applyEntry = (side: 'long' | 'short'): boolean => {
      const plan = createDonchianTrendTradePlan(
        side,
        closeNow,
        upperNow,
        lowerNow,
        exitLower,
        exitUpper,
        atrNow,
        config,
      );
      if (!plan) return false;
      position = side;
      activeStop = plan.stopLoss;
      activeTarget = plan.takeProfit;
      signals[i] = side === 'long' ? 1 : -1;
      stopLoss[i] = activeStop;
      takeProfit[i] = activeTarget;
      pullbackSetup = null;
      return true;
    };

    if (allowsPullbackEntry && pullbackSetup) {
      const refreshed = pullbackSetup.side === 'long'
        ? config.useLong && longTrend && candle.high >= upperNow
        : config.useShort && shortTrend && candle.low <= lowerNow;
      if (refreshed) {
        pullbackSetup.startedAt = i;
        pullbackSetup.middleTouched = false;
      }
      const expired = i - pullbackSetup.startedAt > config.setupExpireBars;
      const invalidated = pullbackSetup.side === 'long' ? closeNow < lowerNow : closeNow > upperNow;
      if (expired || invalidated) pullbackSetup = null;
    }

    if (allowsPullbackEntry && pullbackSetup) {
      const tolerance = atrNow * config.middleTouchToleranceAtr;
      if (pullbackSetup.side === 'long') {
        const touchedMiddle = candle.low <= middleNow + tolerance;
        if (touchedMiddle) pullbackSetup.middleTouched = true;
        const supportConfirmed = pullbackSetup.middleTouched
          && touchedMiddle
          && config.useLong
          && longTrend
          && closeNow > middleNow
          && closeNow > Number(candle.open);
        if (supportConfirmed && applyEntry('long')) continue;
      } else {
        const touchedMiddle = candle.high >= middleNow - tolerance;
        if (touchedMiddle) pullbackSetup.middleTouched = true;
        const resistanceConfirmed = pullbackSetup.middleTouched
          && touchedMiddle
          && config.useShort
          && shortTrend
          && closeNow < middleNow
          && closeNow < Number(candle.open);
        if (resistanceConfirmed && applyEntry('short')) continue;
      }
    }

    const longBreakout = allowsBreakoutEntry && config.useLong && longTrend && closeNow > upperNow;
    if (longBreakout) {
      if (applyEntry('long')) continue;
    }

    const shortBreakout = allowsBreakoutEntry && config.useShort && shortTrend && closeNow < lowerNow;
    if (shortBreakout) {
      if (applyEntry('short')) continue;
    }

    if (allowsPullbackEntry && pullbackSetup == null) {
      if (config.useLong && longTrend && candle.high >= upperNow) {
        pullbackSetup = { side: 'long', startedAt: i, middleTouched: false };
      } else if (config.useShort && shortTrend && candle.low <= lowerNow) {
        pullbackSetup = { side: 'short', startedAt: i, middleTouched: false };
      }
    }
  }

  return {
    signals,
    upper: channel.upper,
    middle: channel.middle,
    lower: channel.lower,
    trendOk,
    sideways,
    stopLoss,
    takeProfit,
  };
}
