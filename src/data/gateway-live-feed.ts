import type { TimeframeKey } from '../catalog/time';
import { disabledSymbols } from '../catalog/symbols';

export type CandleDataLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartLike = {
  config: {
    symbol: string;
    timeframe: TimeframeKey;
  };
  setData: (candles: CandleDataLike[]) => void;
  getCandles: () => CandleDataLike[];
  addNewCandle: (candle: CandleDataLike) => void;
  updateLastCandle: (patch: Pick<CandleDataLike, 'close' | 'high' | 'low' | 'volume'>) => void;
};

type CreateGatewayLiveFeedArgs = {
  chart: ChartLike;
  onDataApplied?: (candles: CandleDataLike[]) => void;
  onLiveTick?: () => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'live' | 'fallback') => void;
  limit?: number;
};

const POLL_INTERVAL_MS_BY_TIMEFRAME: Partial<Record<TimeframeKey, number>> = {
  '1s': 1_000,
  '1m': 1_000,
  '3m': 3_000,
  '5m': 5_000,
  '15m': 8_000,
  '30m': 10_000,
  '1h': 15_000,
  '2h': 15_000,
  '4h': 20_000,
  '1d': 30_000,
  '1w': 60_000,
  '1M': 60_000,
};
const GATEWAY_FAST_SYNC_CONFIG_KEY = 'my-chart-lib.gateway-fast-sync.v1';
const DEFAULT_FAST_SYNC_INTERVAL_MS = 1_000;
const DEFAULT_FAST_SYNC_TICKS = 8;

type GatewayFastSyncConfig = {
  intervalMs: number;
  ticks: number;
};

function clampFastSyncInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FAST_SYNC_INTERVAL_MS;
  return Math.max(300, Math.min(5000, Math.floor(value)));
}

function clampFastSyncTicks(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FAST_SYNC_TICKS;
  return Math.max(0, Math.min(30, Math.floor(value)));
}

function loadGatewayFastSyncConfig(): GatewayFastSyncConfig {
  try {
    const raw = localStorage.getItem(GATEWAY_FAST_SYNC_CONFIG_KEY);
    if (!raw) {
      return {
        intervalMs: DEFAULT_FAST_SYNC_INTERVAL_MS,
        ticks: DEFAULT_FAST_SYNC_TICKS,
      };
    }
    const parsed = JSON.parse(raw) as { intervalMs?: unknown; ticks?: unknown };
    return {
      intervalMs: clampFastSyncInterval(Number(parsed.intervalMs)),
      ticks: clampFastSyncTicks(Number(parsed.ticks)),
    };
  } catch {
    return {
      intervalMs: DEFAULT_FAST_SYNC_INTERVAL_MS,
      ticks: DEFAULT_FAST_SYNC_TICKS,
    };
  }
}

const FX_QUOTES = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.replace(/\s+/g, '').toUpperCase();
  if (normalized === 'NAS100' || normalized === 'NQ') return 'NQ1!';
  return normalized;
}

function stripCryptoFuturesSuffix(symbol: string): string {
  return symbol.endsWith('.P') ? symbol.slice(0, -2) : symbol;
}

function isCryptoLikeSymbol(symbol: string): boolean {
  const base = stripCryptoFuturesSuffix(normalizeSymbol(symbol));
  return base.endsWith('USDT') || base.endsWith('BUSD') || base.endsWith('USDC');
}

function isFxLikeSymbol(symbol: string): boolean {
  const upper = normalizeSymbol(symbol);
  if (!/^[A-Z]{6}$/.test(upper)) return false;
  const base = upper.slice(0, 3);
  const quote = upper.slice(3);
  return FX_QUOTES.includes(base) && FX_QUOTES.includes(quote);
}

function isCommodityLikeSymbol(symbol: string): boolean {
  const upper = normalizeSymbol(symbol);
  return upper.startsWith('XAU') || upper.startsWith('XAG') || upper.startsWith('XPT') || upper.startsWith('USO') || upper.startsWith('WTI') || upper.startsWith('BRENT');
}

export function shouldUseBinanceDirect(symbol: string): boolean {
  return isCryptoLikeSymbol(symbol);
}

export function inferGatewayMarket(symbol: string): 'futures' | 'index' | 'commodity' | 'fx' {
  if (isCommodityLikeSymbol(symbol)) return 'commodity';
  if (isFxLikeSymbol(symbol)) return 'fx';
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NAS100|NQ1!|NDX|HSI|DAX|NIKKEI|KOSPI|KOSDAQ)$/.test(normalizeSymbol(symbol))) {
    return 'index';
  }
  return 'futures';
}

function resolveGatewayBaseUrl(): string {
  const win = window as Window & { __DATA_GATEWAY_URL__?: string };
  const fromWindow = typeof win.__DATA_GATEWAY_URL__ === 'string' ? win.__DATA_GATEWAY_URL__.trim() : '';
  const fromStorage = localStorage.getItem('my-chart-lib.data-gateway-url')?.trim() ?? '';
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DATA_GATEWAY_URL?.trim() ?? '';
  if (fromWindow) return fromWindow.replace(/\/+$/, '');
  if (fromStorage) return fromStorage.replace(/\/+$/, '');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  // 로컬 개발 환경은 로컬 게이트웨이, 그 외(Netlify 등)는 같은 오리진의 Functions 사용
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8787';
  }
  return window.location.origin;
}

function sanitizeCandles(rows: unknown): CandleDataLike[] {
  if (!Array.isArray(rows)) return [];
  const parsed = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const v = row as Record<string, unknown>;
      const time = Number(v.time);
      const open = Number(v.open);
      const high = Number(v.high);
      const low = Number(v.low);
      const close = Number(v.close);
      const volume = Number(v.volume);
      if (![time, open, high, low, close, volume].every((n) => Number.isFinite(n))) return null;
      return {
        time: Math.floor(time),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((item): item is CandleDataLike => item != null)
    .sort((a, b) => a.time - b.time);

  const map = new Map<number, CandleDataLike>();
  parsed.forEach((item) => {
    map.set(item.time, item);
  });
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

async function fetchGatewayCandles(
  baseUrl: string,
  market: string,
  symbol: string,
  timeframe: TimeframeKey,
  limit: number,
  signal: AbortSignal,
): Promise<CandleDataLike[]> {
  const query = new URLSearchParams({
    market,
    symbol: normalizeSymbol(symbol),
    timeframe,
    limit: String(Math.max(1, Math.min(3000, limit))),
  });

  const response = await fetch(`${baseUrl}/candles?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new Error(`Gateway candles error: ${response.status}`);
  }
  const json = await response.json() as { candles?: unknown };
  return sanitizeCandles(json.candles);
}

export function createGatewayLiveFeed({
  chart,
  onDataApplied,
  onLiveTick,
  onStatusChange,
  limit = 300,
}: CreateGatewayLiveFeedArgs): {
  start: () => Promise<boolean>;
  reload: () => Promise<boolean>;
  stop: () => void;
} {
  let running = false;
  let pollingTimer: number | null = null;
  let fastPollingTimer: number | null = null;
  let abortController: AbortController | null = null;
  let connecting = false;
  let fastSyncConfig = loadGatewayFastSyncConfig();

  const stopPolling = () => {
    if (pollingTimer == null) return;
    window.clearInterval(pollingTimer);
    pollingTimer = null;
  };
  const stopFastPolling = () => {
    if (fastPollingTimer == null) return;
    window.clearInterval(fastPollingTimer);
    fastPollingTimer = null;
  };

  const stopFetch = () => {
    if (!abortController) return;
    abortController.abort();
    abortController = null;
  };

  const applySnapshot = (candles: CandleDataLike[]) => {
    chart.setData(candles);
    onDataApplied?.(candles);
  };

  const applyIncremental = (latestRows: CandleDataLike[]) => {
    const current = chart.getCandles();
    if (!current.length) {
      applySnapshot(latestRows);
      onLiveTick?.();
      return;
    }

    const last = current[current.length - 1];
    const updates = latestRows.filter((row) => row.time >= last.time);
    if (!updates.length) return;

    updates.forEach((next) => {
      const nowLast = chart.getCandles()[chart.getCandles().length - 1];
      if (!nowLast) {
        chart.setData([next]);
        return;
      }
      if (next.time > nowLast.time) {
        chart.addNewCandle(next);
        return;
      }
      if (next.time === nowLast.time) {
        chart.updateLastCandle({
          close: next.close,
          high: next.high,
          low: next.low,
          volume: next.volume,
        });
      }
    });
    onLiveTick?.();
  };

  const pollOnce = async (fullReload: boolean): Promise<boolean> => {
    if (connecting) return false;

    const symbol = chart.config.symbol;
    if (disabledSymbols.has(normalizeSymbol(symbol))) {
      if (running) onStatusChange?.('fallback');
      return false;
    }

    connecting = true;
    stopFetch();
    abortController = new AbortController();

    try {
      const market = inferGatewayMarket(symbol);
      const timeframe = chart.config.timeframe;
      const baseUrl = resolveGatewayBaseUrl();
      const candles = await fetchGatewayCandles(
        baseUrl,
        market,
        symbol,
        timeframe,
        limit,
        abortController.signal,
      );

      if (!running) {
        onStatusChange?.('idle');
        return false;
      }

      if (fullReload) {
        applySnapshot(candles);
      } else {
        applyIncremental(candles);
      }

      onStatusChange?.('live');
      return true;
    } catch {
      if (running) onStatusChange?.('fallback');
      return false;
    } finally {
      abortController = null;
      connecting = false;
    }
  };

  const setupPolling = () => {
    stopPolling();
    stopFastPolling();
    fastSyncConfig = loadGatewayFastSyncConfig();
    const intervalMs = POLL_INTERVAL_MS_BY_TIMEFRAME[chart.config.timeframe] ?? 5_000;
    pollingTimer = window.setInterval(() => {
      if (!running) return;
      void pollOnce(false);
    }, intervalMs);

    // After symbol/timeframe changes, run a short 1s sync burst for snappy UI updates.
    if (fastSyncConfig.ticks <= 0) return;
    let ticks = 0;
    fastPollingTimer = window.setInterval(() => {
      if (!running) {
        stopFastPolling();
        return;
      }
      ticks += 1;
      void pollOnce(false);
      if (ticks >= fastSyncConfig.ticks) {
        stopFastPolling();
      }
    }, fastSyncConfig.intervalMs);
  };

  const restart = async (reloadHistory: boolean): Promise<boolean> => {
    onStatusChange?.('connecting');
    const ok = await pollOnce(reloadHistory);
    if (ok) setupPolling();
    return ok;
  };

  const start = async (): Promise<boolean> => {
    running = true;
    return restart(true);
  };

  const reload = async (): Promise<boolean> => {
    running = true;
    return restart(true);
  };

  const stop = () => {
    running = false;
    stopPolling();
    stopFastPolling();
    stopFetch();
    onStatusChange?.('idle');
  };

  window.addEventListener('my-chart-lib:gateway-fast-sync-updated', () => {
    fastSyncConfig = loadGatewayFastSyncConfig();
    if (running) setupPolling();
  });

  return {
    start,
    reload,
    stop,
  };
}
