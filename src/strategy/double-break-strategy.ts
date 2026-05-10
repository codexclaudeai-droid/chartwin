export type DoubleBreakCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type DoubleBreakSameBarMode = 'conservative' | 'optimistic' | 'candle';
export type DoubleBreakRunnerExitMode = 'tp2' | 'opposite';

export type DoubleBreakConfig = {
  bbPeriod: number;
  bbStd: number;
  envPeriod: number;
  envPct: number;
  atrPeriod: number;
  tp1Multi: number;
  tp2Multi: number;
  slMulti: number;
  crossTol: number;
  minBarGap: number;
  useAdxFilter: boolean;
  adxPeriod: number;
  adxMin: number;
  sameBarMode: DoubleBreakSameBarMode;
  runnerExitMode: DoubleBreakRunnerExitMode;
};

export type BandPoint = {
  upper: number | null;
  mid: number | null;
  lower: number | null;
};

export type LongSignal = {
  index: number;
  type: 'LONG';
  price: number;
  bbUpper: number;
  envUpper: number;
  resistance: number;
  tp1: number;
  tp2: number;
  sl: number;
  atr: number;
  adx: number | null;
  open: number;
  high: number;
  low: number;
};

export type ShortSignal = {
  index: number;
  type: 'SHORT';
  price: number;
  bbLower: number;
  envLower: number;
  support: number;
  tp1: number;
  tp2: number;
  sl: number;
  atr: number;
  adx: number | null;
  open: number;
  high: number;
  low: number;
};

export type DoubleBreakResult = {
  longSignals: LongSignal[];
  shortSignals: ShortSignal[];
  longZones: number[];
  shortZones: number[];
  bbBands: BandPoint[];
  envBands: BandPoint[];
  atr: Array<number | null>;
  adx: Array<number | null>;
  config: DoubleBreakConfig;
};

export const DEFAULT_CONFIG: DoubleBreakConfig = {
  bbPeriod: 20,
  bbStd: 2.0,
  envPeriod: 20,
  envPct: 3.0,
  atrPeriod: 14,
  tp1Multi: 1.5,
  tp2Multi: 2.5,
  slMulti: 1.0,
  crossTol: 0.018,
  minBarGap: 3,
  useAdxFilter: false,
  adxPeriod: 14,
  adxMin: 20,
  sameBarMode: 'conservative',
  runnerExitMode: 'tp2',
};

export function calcSMA(values: number[], period: number): Array<number | null> {
  if (period <= 0) {
    throw new Error('[DoubleBreakStrategy] SMA period must be >= 1.');
  }

  let rollingSum = 0;
  return values.map((value, i) => {
    rollingSum += value;
    if (i >= period) rollingSum -= values[i - period];
    if (i < period - 1) return null;
    return rollingSum / period;
  });
}

export function calcBollingerBands(closes: number[], period: number, mult: number): BandPoint[] {
  const ma = calcSMA(closes, period);
  return closes.map((_, i) => {
    const mid = ma[i];
    if (mid === null) return { upper: null, mid: null, lower: null };

    const slice = closes.slice(i - period + 1, i + 1);
    const std = Math.sqrt(slice.reduce((sum, value) => sum + (value - mid) ** 2, 0) / period);
    return {
      upper: mid + mult * std,
      mid,
      lower: mid - mult * std,
    };
  });
}

export function calcEnvelopeBands(closes: number[], period: number, pct: number): BandPoint[] {
  const ma = calcSMA(closes, period);
  return ma.map((mid) => {
    if (mid === null) return { upper: null, mid: null, lower: null };
    return {
      upper: mid * (1 + pct / 100),
      mid,
      lower: mid * (1 - pct / 100),
    };
  });
}

export function calcATR(candles: DoubleBreakCandle[], period: number): Array<number | null> {
  const trueRanges = candles.map((candle, i) => {
    if (i === 0) return candle.high - candle.low;
    const prevClose = candles[i - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    );
  });

  return calcSMA(trueRanges, period);
}

export function calcADX(candles: DoubleBreakCandle[], period: number): Array<number | null> {
  if (period <= 0) {
    throw new Error('[DoubleBreakStrategy] ADX period must be >= 1.');
  }
  if (!candles.length) return [];

  const n = candles.length;
  const tr = new Array<number>(n).fill(0);
  const plusDm = new Array<number>(n).fill(0);
  const minusDm = new Array<number>(n).fill(0);
  const dx = new Array<number | null>(n).fill(null);
  const adx = new Array<number | null>(n).fill(null);

  for (let i = 1; i < n; i += 1) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
  }

  if (n <= period) return adx;

  let trSmooth = 0;
  let plusSmooth = 0;
  let minusSmooth = 0;
  for (let i = 1; i <= period; i += 1) {
    trSmooth += tr[i];
    plusSmooth += plusDm[i];
    minusSmooth += minusDm[i];
  }

  for (let i = period; i < n; i += 1) {
    if (i > period) {
      trSmooth = trSmooth - trSmooth / period + tr[i];
      plusSmooth = plusSmooth - plusSmooth / period + plusDm[i];
      minusSmooth = minusSmooth - minusSmooth / period + minusDm[i];
    }

    if (trSmooth <= Number.EPSILON) {
      dx[i] = 0;
      continue;
    }

    const plusDi = (plusSmooth / trSmooth) * 100;
    const minusDi = (minusSmooth / trSmooth) * 100;
    const diSum = plusDi + minusDi;
    dx[i] = diSum <= Number.EPSILON ? 0 : (Math.abs(plusDi - minusDi) / diSum) * 100;
  }

  let dxSeed = 0;
  let dxCount = 0;
  const firstAdxIndex = period * 2 - 1;
  for (let i = period; i <= firstAdxIndex && i < n; i += 1) {
    if (dx[i] != null) {
      dxSeed += dx[i] as number;
      dxCount += 1;
    }
  }

  if (dxCount < period || firstAdxIndex >= n) return adx;
  adx[firstAdxIndex] = dxSeed / period;

  for (let i = firstAdxIndex + 1; i < n; i += 1) {
    const prev = adx[i - 1];
    const currDx = dx[i];
    if (prev == null || currDx == null) continue;
    adx[i] = ((prev * (period - 1)) + currDx) / period;
  }

  return adx;
}

function proximity(a: number, b: number): number {
  const denominator = Math.max(Math.abs((a + b) / 2), Number.EPSILON);
  return Math.abs(a - b) / denominator;
}

export function detectSignals(
  candles: DoubleBreakCandle[],
  bb: BandPoint[],
  env: BandPoint[],
  atrArr: Array<number | null>,
  cfg: DoubleBreakConfig,
  adxArr: Array<number | null> = [],
): Pick<DoubleBreakResult, 'longSignals' | 'shortSignals' | 'longZones' | 'shortZones'> {
  const longSignals: LongSignal[] = [];
  const shortSignals: ShortSignal[] = [];
  const longZones: number[] = [];
  const shortZones: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const bbU = bb[i]?.upper;
    const bbL = bb[i]?.lower;
    const envU = env[i]?.upper;
    const envL = env[i]?.lower;
    const atrV = atrArr[i];
    const adxV = adxArr[i] ?? null;

    if (bbU === null || bbL === null || envU === null || envL === null || atrV === null) continue;
    if (bbU === undefined || bbL === undefined || envU === undefined || envL === undefined || atrV === undefined) continue;

    const adxAllowed = !cfg.useAdxFilter || (adxV != null && adxV >= cfg.adxMin);
    const { open, close, high, low } = candles[i];
    const isBull = close > open;
    const isBear = close < open;

    const isLongZone = proximity(bbU, envU) <= cfg.crossTol;
    if (isLongZone) longZones.push(i);

    if (isLongZone && isBull && adxAllowed) {
      const resistance = Math.max(bbU, envU);
      if (close > resistance) {
        const last = longSignals[longSignals.length - 1];
        if (!last || i - last.index >= cfg.minBarGap) {
          longSignals.push({
            index: i,
            type: 'LONG',
            price: close,
            bbUpper: bbU,
            envUpper: envU,
            resistance,
            tp1: close + atrV * cfg.tp1Multi,
            tp2: close + atrV * cfg.tp2Multi,
            sl: close - atrV * cfg.slMulti,
            atr: atrV,
            adx: adxV,
            open,
            high,
            low,
          });
        }
      }
    }

    const isShortZone = proximity(bbL, envL) <= cfg.crossTol;
    if (isShortZone) shortZones.push(i);

    if (isShortZone && isBear && adxAllowed) {
      const support = Math.min(bbL, envL);
      if (close < support) {
        const last = shortSignals[shortSignals.length - 1];
        if (!last || i - last.index >= cfg.minBarGap) {
          shortSignals.push({
            index: i,
            type: 'SHORT',
            price: close,
            bbLower: bbL,
            envLower: envL,
            support,
            tp1: close - atrV * cfg.tp1Multi,
            tp2: close - atrV * cfg.tp2Multi,
            sl: close + atrV * cfg.slMulti,
            atr: atrV,
            adx: adxV,
            open,
            high,
            low,
          });
        }
      }
    }
  }

  return { longSignals, shortSignals, longZones, shortZones };
}

export class DoubleBreakStrategy {
  private cfg: DoubleBreakConfig;

  constructor(userConfig: Partial<DoubleBreakConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...userConfig };
  }

  setConfig(patch: Partial<DoubleBreakConfig>): void {
    this.cfg = { ...this.cfg, ...patch };
  }

  run(candles: DoubleBreakCandle[]): DoubleBreakResult {
    if (!Array.isArray(candles) || candles.length === 0) {
      throw new Error('[DoubleBreakStrategy] candles array is empty.');
    }

    const cfg = this.cfg;
    const closes = candles.map((candle) => candle.close);
    const bbBands = calcBollingerBands(closes, cfg.bbPeriod, cfg.bbStd);
    const envBands = calcEnvelopeBands(closes, cfg.envPeriod, cfg.envPct);
    const atr = calcATR(candles, cfg.atrPeriod);
    const adx = calcADX(candles, cfg.adxPeriod);
    const { longSignals, shortSignals, longZones, shortZones } = detectSignals(
      candles,
      bbBands,
      envBands,
      atr,
      cfg,
      adx,
    );

    return {
      longSignals,
      shortSignals,
      longZones,
      shortZones,
      bbBands,
      envBands,
      atr,
      adx,
      config: { ...cfg },
    };
  }

  runLast(candles: DoubleBreakCandle[]): { signal: 'LONG' | 'SHORT' | null; detail: LongSignal | ShortSignal | null } {
    const result = this.run(candles);
    const index = candles.length - 1;
    const longMatch = result.longSignals.find((signal) => signal.index === index);
    const shortMatch = result.shortSignals.find((signal) => signal.index === index);

    if (longMatch) return { signal: 'LONG', detail: longMatch };
    if (shortMatch) return { signal: 'SHORT', detail: shortMatch };
    return { signal: null, detail: null };
  }
}
