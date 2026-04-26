interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type StrategySignal = -1 | 0 | 1;

type ComputeRequest = {
  type: 'compute';
  requestId: number;
  compiledJs: string;
  candles: CandleData[];
  changedFrom: number;
  previousSignals: StrategySignal[];
};

type ComputeResponse = {
  type: 'result';
  requestId: number;
  signals: StrategySignal[];
  error?: string;
};

type TaApi = {
  sma: (series: number[], period: number, index: number) => number | null;
  crossover: (a: number[], b: number[], index: number) => boolean;
  crossunder: (a: number[], b: number[], index: number) => boolean;
};

type StrategyFn = (ctx: {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}, index: number, ta: TaApi) => StrategySignal | boolean | { buy?: boolean; sell?: boolean };

const toSignal = (raw: ReturnType<StrategyFn>): StrategySignal => {
  if (typeof raw === 'number') {
    if (raw > 0) return 1;
    if (raw < 0) return -1;
    return 0;
  }
  if (typeof raw === 'boolean') {
    return raw ? 1 : 0;
  }
  if (raw && typeof raw === 'object') {
    if (raw.buy) return 1;
    if (raw.sell) return -1;
  }
  return 0;
};

const buildTa = (): TaApi => ({
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
});

self.onmessage = (event: MessageEvent<ComputeRequest>) => {
  const payload = event.data;
  if (payload.type !== 'compute') return;

  try {
    const strategyFn = new Function(`return (${payload.compiledJs});`)() as StrategyFn;
    const candles = payload.candles;
    const close = candles.map((c) => c.close);
    const open = candles.map((c) => c.open);
    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const volume = candles.map((c) => c.volume);

    const ta = buildTa();
    const ctx = { open, high, low, close, volume };

    const previous = payload.previousSignals ?? [];
    const signals: StrategySignal[] = previous.length === candles.length
      ? [...previous]
      : new Array(candles.length).fill(0);

    const recomputeFrom = Math.max(0, Math.min(payload.changedFrom - 300, candles.length - 1));
    for (let i = recomputeFrom; i < candles.length; i += 1) {
      signals[i] = toSignal(strategyFn(ctx, i, ta));
    }

    const response: ComputeResponse = {
      type: 'result',
      requestId: payload.requestId,
      signals,
    };
    postMessage(response);
  } catch (error) {
    const response: ComputeResponse = {
      type: 'result',
      requestId: payload.requestId,
      signals: payload.previousSignals ?? [],
      error: error instanceof Error ? error.message : String(error),
    };
    postMessage(response);
  }
};
