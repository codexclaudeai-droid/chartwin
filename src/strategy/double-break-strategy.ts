export type DoubleBreakCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

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
};

export function calcSMA(values: number[], period: number): Array<number | null> {
  if (period <= 0) {
    throw new Error('[DoubleBreakStrategy] SMA period는 1 이상이어야 합니다.');
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

    if (bbU === null || bbL === null || envU === null || envL === null || atrV === null) continue;
    if (bbU === undefined || bbL === undefined || envU === undefined || envL === undefined || atrV === undefined) continue;

    const { open, close, high, low } = candles[i];
    const isBull = close > open;
    const isBear = close < open;

    const isLongZone = proximity(bbU, envU) <= cfg.crossTol;
    if (isLongZone) longZones.push(i);

    if (isLongZone && isBull) {
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
            open,
            high,
            low,
          });
        }
      }
    }

    const isShortZone = proximity(bbL, envL) <= cfg.crossTol;
    if (isShortZone) shortZones.push(i);

    if (isShortZone && isBear) {
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
      throw new Error('[DoubleBreakStrategy] candles 배열이 비어 있습니다.');
    }

    const cfg = this.cfg;
    const closes = candles.map((candle) => candle.close);
    const bbBands = calcBollingerBands(closes, cfg.bbPeriod, cfg.bbStd);
    const envBands = calcEnvelopeBands(closes, cfg.envPeriod, cfg.envPct);
    const atr = calcATR(candles, cfg.atrPeriod);
    const { longSignals, shortSignals, longZones, shortZones } = detectSignals(
      candles,
      bbBands,
      envBands,
      atr,
      cfg,
    );

    return {
      longSignals,
      shortSignals,
      longZones,
      shortZones,
      bbBands,
      envBands,
      atr,
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
