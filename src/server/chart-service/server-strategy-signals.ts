import type { TimeframeKey } from '../../catalog/time.ts';
import { ALL_STRATEGIES } from '../../strategy/strategies/index.ts';
import {
  buildStrategyDefinition,
  type StrategyDefinition,
  type StrategySignal,
} from '../../strategy/strategy-service.ts';

export type ServerStrategyCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TaApi = {
  sma: (series: number[], period: number, index: number) => number | null;
  crossover: (a: number[], b: number[], index: number) => boolean;
  crossunder: (a: number[], b: number[], index: number) => boolean;
};

type StrategyFn = (
  ctx: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    __strategyParams: Record<string, unknown>;
    __symbol: string;
  },
  index: number,
  ta: TaApi,
) => StrategySignal | boolean | { buy?: boolean; sell?: boolean };

let defaultServerStrategies: StrategyDefinition[] | null = null;

export function getDefaultServerStrategies(): StrategyDefinition[] {
  defaultServerStrategies ??= ALL_STRATEGIES.map((strategy) => buildStrategyDefinition({
    ...strategy,
    active: true,
  }));
  return defaultServerStrategies.map((strategy) => ({
    ...strategy,
    params: strategy.params ? { ...strategy.params } : undefined,
  }));
}

export function findServerStrategyById(
  strategyId: string,
  strategies = getDefaultServerStrategies(),
): StrategyDefinition | null {
  return strategies.find((strategy) => strategy.id === strategyId) ?? null;
}

export function computeServerStrategySignals(args: {
  strategy: StrategyDefinition;
  candles: ServerStrategyCandle[];
  symbol: string;
}): StrategySignal[] {
  const candles = sanitizeCandles(args.candles);
  if (!candles.length) return [];

  try {
    const strategyFn = new Function(`return (${args.strategy.obfuscatedJs || args.strategy.compiledJs});`)() as StrategyFn;
    const context = {
      open: candles.map((candle) => candle.open),
      high: candles.map((candle) => candle.high),
      low: candles.map((candle) => candle.low),
      close: candles.map((candle) => candle.close),
      volume: candles.map((candle) => candle.volume),
      __strategyParams: args.strategy.params ?? {},
      __symbol: args.symbol,
    };
    const ta = buildTa();
    return candles.map((_, index) => toSignal(strategyFn(context, index, ta)));
  } catch {
    return [];
  }
}

function sanitizeCandles(candles: ServerStrategyCandle[]): ServerStrategyCandle[] {
  return candles
    .map((candle) => ({
      time: Math.floor(Number(candle.time)),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
    }))
    .filter((candle) => (
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.volume)
    ))
    .sort((left, right) => left.time - right.time);
}

function buildTa(): TaApi {
  return {
    sma(series: number[], period: number, index: number): number | null {
      if (period <= 0 || index < period - 1) return null;
      let sum = 0;
      for (let i = index - period + 1; i <= index; i += 1) {
        sum += series[i];
      }
      return sum / period;
    },
    crossover(a: number[], b: number[], index: number): boolean {
      if (index <= 0) return false;
      return a[index - 1] <= b[index - 1] && a[index] > b[index];
    },
    crossunder(a: number[], b: number[], index: number): boolean {
      if (index <= 0) return false;
      return a[index - 1] >= b[index - 1] && a[index] < b[index];
    },
  };
}

function toSignal(raw: ReturnType<StrategyFn>): StrategySignal {
  if (typeof raw === 'number') return raw > 0 ? 1 : raw < 0 ? -1 : 0;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  if (raw && typeof raw === 'object') {
    if (raw.buy) return 1;
    if (raw.sell) return -1;
  }
  return 0;
}

export function isSupportedServerTimeframe(value: string): value is TimeframeKey {
  return [
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '2h',
    '4h',
    '1d',
    '1w',
    '1M',
  ].includes(value);
}
