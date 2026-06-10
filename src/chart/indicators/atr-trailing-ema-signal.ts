import { calculateAtr } from './atr.ts';
import { calculateEmaFromValues } from './moving-average.ts';
import type { IndicatorCandle, NullableSeries } from './types.ts';

export type AtrTrailingEmaSignalMode = 'basic' | 'filtered';

export interface AtrTrailingEmaSignalOptions {
  mode?: AtrTrailingEmaSignalMode;
  sensitivity?: number;
  atrPeriod?: number;
  signalEmaLength?: number;
  trendEmaLength?: number;
}

export interface AtrTrailingEmaSignalResult {
  atr: NullableSeries;
  atrStop: NullableSeries;
  signalEma: NullableSeries;
  trendEma: NullableSeries;
  position: number[];
  buySignal: boolean[];
  sellSignal: boolean[];
}

export interface AtrTrailingStopOriginOptions {
  sensitivity?: number;
  atrPeriod?: number;
  trendEmaLength?: number;
}

function crossover(
  left: number | null,
  right: number | null,
  prevLeft: number | null,
  prevRight: number | null,
): boolean {
  if (left == null || right == null || prevLeft == null || prevRight == null) return false;
  return prevLeft <= prevRight && left > right;
}

export function calculateAtrTrailingEmaSignal(
  candles: IndicatorCandle[],
  options: AtrTrailingEmaSignalOptions = {},
): AtrTrailingEmaSignalResult {
  const mode: AtrTrailingEmaSignalMode = options.mode === 'filtered' ? 'filtered' : 'basic';
  const sensitivity = Math.max(0.000001, Number(options.sensitivity ?? 3) || 3);
  const atrPeriod = Math.max(1, Math.floor(Number(options.atrPeriod ?? 2) || 2));
  const signalEmaLength = Math.max(1, Math.floor(Number(options.signalEmaLength ?? 1) || 1));
  const trendEmaLength = Math.max(1, Math.floor(Number(options.trendEmaLength ?? 240) || 240));
  const n = candles.length;
  const closes = candles.map((candle) => candle.close);
  const atr = calculateAtr(candles, atrPeriod);
  const signalEma = calculateEmaFromValues(closes, signalEmaLength);
  const trendEma = calculateEmaFromValues(closes, trendEmaLength);
  const atrStop: NullableSeries = new Array(n).fill(null);
  const position: number[] = new Array(n).fill(0);
  const buySignal: boolean[] = new Array(n).fill(false);
  const sellSignal: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i += 1) {
    const price = closes[i];
    const currentAtr = atr[i];
    if (currentAtr == null || !Number.isFinite(currentAtr)) {
      position[i] = i > 0 ? position[i - 1] : 0;
      continue;
    }

    const nLoss = sensitivity * currentAtr;
    const prevStop = i > 0 ? (atrStop[i - 1] ?? 0) : 0;
    const prevPrice = i > 0 ? closes[i - 1] : price;

    if (price > prevStop && prevPrice > prevStop) {
      atrStop[i] = Math.max(prevStop, price - nLoss);
    } else if (price < prevStop && prevPrice < prevStop) {
      atrStop[i] = Math.min(prevStop, price + nLoss);
    } else {
      atrStop[i] = price > prevStop ? price - nLoss : price + nLoss;
    }

    if (i > 0 && prevPrice < prevStop && price > prevStop) {
      position[i] = 1;
    } else if (i > 0 && prevPrice > prevStop && price < prevStop) {
      position[i] = -1;
    } else {
      position[i] = i > 0 ? position[i - 1] : 0;
    }

    const crossedAbove = crossover(signalEma[i], atrStop[i], i > 0 ? signalEma[i - 1] : null, i > 0 ? atrStop[i - 1] : null);
    const crossedBelow = crossover(atrStop[i], signalEma[i], i > 0 ? atrStop[i - 1] : null, i > 0 ? signalEma[i - 1] : null);
    const buyBase = price > atrStop[i]! && crossedAbove;
    const sellBase = price < atrStop[i]! && crossedBelow;
    const trendValue = trendEma[i];
    const trendAllowsBuy = mode === 'basic' || (trendValue != null && price > trendValue);
    const trendAllowsSell = mode === 'basic' || (trendValue != null && price < trendValue);

    buySignal[i] = buyBase && trendAllowsBuy;
    sellSignal[i] = sellBase && trendAllowsSell;
  }

  return { atr, atrStop, signalEma, trendEma, position, buySignal, sellSignal };
}

export function calculateAtrTrailingStopOrigin(
  candles: IndicatorCandle[],
  options: AtrTrailingStopOriginOptions = {},
): AtrTrailingEmaSignalResult {
  const sensitivity = Math.max(0.000001, Number(options.sensitivity ?? 3) || 3);
  const atrPeriod = Math.max(1, Math.floor(Number(options.atrPeriod ?? 2) || 2));
  const trendEmaLength = Math.max(1, Math.floor(Number(options.trendEmaLength ?? 240) || 240));
  const n = candles.length;
  const closes = candles.map((candle) => candle.close);
  const atr = calculateAtr(candles, atrPeriod);
  const signalEma = calculateEmaFromValues(closes, 1);
  const trendEma = calculateEmaFromValues(closes, trendEmaLength);
  const atrStop: NullableSeries = new Array(n).fill(null);
  const position: number[] = new Array(n).fill(0);
  const buySignal: boolean[] = new Array(n).fill(false);
  const sellSignal: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i += 1) {
    const price = closes[i];
    const currentAtr = atr[i];
    if (currentAtr == null || !Number.isFinite(currentAtr)) {
      position[i] = i > 0 ? position[i - 1] : 0;
      continue;
    }

    const nLoss = sensitivity * currentAtr;
    const prevStop = i > 0 ? (atrStop[i - 1] ?? 0) : 0;
    const prevPrice = i > 0 ? closes[i - 1] : price;

    if (price > prevStop && prevPrice > prevStop) {
      atrStop[i] = Math.max(prevStop, price - nLoss);
    } else if (price < prevStop && prevPrice < prevStop) {
      atrStop[i] = Math.min(prevStop, price + nLoss);
    } else {
      atrStop[i] = price > prevStop ? price - nLoss : price + nLoss;
    }

    if (i > 0 && prevPrice < prevStop && price > prevStop) {
      position[i] = 1;
    } else if (i > 0 && prevPrice > prevStop && price < prevStop) {
      position[i] = -1;
    } else {
      position[i] = i > 0 ? position[i - 1] : 0;
    }

    const crossedAbove = crossover(signalEma[i], atrStop[i], i > 0 ? signalEma[i - 1] : null, i > 0 ? atrStop[i - 1] : null);
    const crossedBelow = crossover(atrStop[i], signalEma[i], i > 0 ? atrStop[i - 1] : null, i > 0 ? signalEma[i - 1] : null);
    buySignal[i] = price > atrStop[i]! && crossedAbove;
    sellSignal[i] = price < atrStop[i]! && crossedBelow;
  }

  return { atr, atrStop, signalEma, trendEma, position, buySignal, sellSignal };
}
