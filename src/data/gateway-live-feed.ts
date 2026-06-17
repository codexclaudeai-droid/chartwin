import type { TimeframeKey } from '../catalog/time';
import { TIMEFRAME_SECONDS } from '../catalog/time';
import { disabledSymbols } from '../catalog/symbols';
import {
  inferGatewayMarket,
  inferGatewayReportMarket,
  normalizeSymbol,
  shouldUseBinanceDirect,
} from './gateway-market';
export {
  inferGatewayMarket,
  inferGatewayReportMarket,
  normalizeSymbol,
  shouldUseBinanceDirect,
} from './gateway-market';
import { sanitizeGatewayCandles } from './gateway-candle-sanitize';
import type { FootprintPriceLevel } from '../types.ts';

export type CandleDataLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  volumeDelta?: number;
  footprint?: FootprintPriceLevel[];
};

type ChartLike = {
  config: {
    symbol: string;
    timeframe: TimeframeKey;
  };
  setData: (candles: CandleDataLike[]) => void;
  getCandles: () => CandleDataLike[];
  addNewCandle: (candle: CandleDataLike) => void;
  updateLastCandle: (patch: Partial<CandleDataLike>) => void;
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


function resolveGatewayBaseUrl(): string {
  const win = window as Window & { __DATA_GATEWAY_URL__?: string };
  const fromWindow = typeof win.__DATA_GATEWAY_URL__ === 'string' ? win.__DATA_GATEWAY_URL__.trim() : '';
  const fromStorage = localStorage.getItem('my-chart-lib.data-gateway-url')?.trim() ?? '';
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DATA_GATEWAY_URL?.trim() ?? '';
  if (fromWindow) return fromWindow.replace(/\/+$/, '');
  if (fromStorage) return fromStorage.replace(/\/+$/, '');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  // Local development uses the local gateway; deployed builds use the same origin.
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8787';
  }
  return window.location.origin;
}

function canAggregateGatewayFallback(timeframe: TimeframeKey): boolean {
  const targetSec = TIMEFRAME_SECONDS[timeframe];
  return Number.isFinite(targetSec) && targetSec > 60 && targetSec % 60 === 0;
}

function cloneFootprint(levels: FootprintPriceLevel[] | undefined): FootprintPriceLevel[] | undefined {
  return levels?.map((level) => ({ ...level }));
}

function mergeFootprintLevels(
  current: FootprintPriceLevel[] | undefined,
  incoming: FootprintPriceLevel[] | undefined,
): FootprintPriceLevel[] | undefined {
  if (!current?.length && !incoming?.length) return undefined;
  const levels = new Map<number, FootprintPriceLevel>();
  [...(current ?? []), ...(incoming ?? [])].forEach((level) => {
    const price = Number(level.price);
    if (!Number.isFinite(price)) return;
    const existing = levels.get(price) ?? {
      price,
      buyVolume: 0,
      sellVolume: 0,
      volumeDelta: 0,
      totalVolume: 0,
    };
    existing.buyVolume += Number(level.buyVolume) || 0;
    existing.sellVolume += Number(level.sellVolume) || 0;
    existing.volumeDelta = existing.buyVolume - existing.sellVolume;
    existing.totalVolume = existing.buyVolume + existing.sellVolume;
    levels.set(price, existing);
  });
  return Array.from(levels.values()).sort((a, b) => a.price - b.price);
}

function enrichAggregatedCandle(target: CandleDataLike, source: CandleDataLike): void {
  if (Number.isFinite(source.buyVolume)) {
    target.buyVolume = (target.buyVolume ?? 0) + Number(source.buyVolume);
  }
  if (Number.isFinite(source.sellVolume)) {
    target.sellVolume = (target.sellVolume ?? 0) + Number(source.sellVolume);
  }
  if (Number.isFinite(source.volumeDelta)) {
    target.volumeDelta = (target.volumeDelta ?? 0) + Number(source.volumeDelta);
  } else if (Number.isFinite(source.buyVolume) && Number.isFinite(source.sellVolume)) {
    target.volumeDelta = (target.volumeDelta ?? 0) + Number(source.buyVolume) - Number(source.sellVolume);
  }
  target.footprint = mergeFootprintLevels(target.footprint, source.footprint);
}

function hasSameFootprint(a: FootprintPriceLevel[] | undefined, b: FootprintPriceLevel[] | undefined): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a?.length || !b?.length || a.length !== b.length) return false;
  return a.every((level, index) => {
    const other = b[index];
    return level.price === other.price
      && level.buyVolume === other.buyVolume
      && level.sellVolume === other.sellVolume
      && level.volumeDelta === other.volumeDelta
      && level.totalVolume === other.totalVolume;
  });
}

export function aggregateGatewayCandlesToTimeframe(
  candles: CandleDataLike[],
  timeframe: TimeframeKey,
): CandleDataLike[] {
  const targetSec = TIMEFRAME_SECONDS[timeframe];
  if (!Array.isArray(candles) || !Number.isFinite(targetSec) || targetSec <= 60 || targetSec % 60 !== 0) {
    return Array.isArray(candles) ? candles : [];
  }

  const buckets = new Map<number, CandleDataLike>();
  candles
    .slice()
    .sort((a, b) => a.time - b.time)
    .forEach((candle) => {
      const bucketTime = Math.floor(candle.time / targetSec) * targetSec;
      const existing = buckets.get(bucketTime);
      if (!existing) {
        buckets.set(bucketTime, { ...candle, time: bucketTime, footprint: cloneFootprint(candle.footprint) });
        return;
      }
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
      existing.volume += candle.volume;
      enrichAggregatedCandle(existing, candle);
    });

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
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
  const candles = sanitizeGatewayCandles(json.candles);
  if (!candles.length && timeframe !== '1m' && canAggregateGatewayFallback(timeframe)) {
    const sourceMultiplier = Math.max(1, Math.ceil((TIMEFRAME_SECONDS[timeframe] ?? 60) / 60));
    const fallbackRows = await fetchGatewayCandles(
      baseUrl,
      market,
      symbol,
      '1m',
      Math.min(3000, Math.max(1, limit * sourceMultiplier)),
      signal,
    );
    return aggregateGatewayCandlesToTimeframe(fallbackRows, timeframe).slice(-Math.max(1, limit));
  }

  return candles;
}

export async function fetchGatewayReportCandles(args: {
  symbol: string;
  timeframe: TimeframeKey;
  limit: number;
  fromSec?: number | null;
  toSec?: number | null;
  signal?: AbortSignal;
}): Promise<CandleDataLike[]> {
  const market = inferGatewayReportMarket(args.symbol);
  const limit = Math.max(1, Math.floor(Number(args.limit) || 0));
  const cappedLimit = Math.min(100000, limit);
  const query = new URLSearchParams({
    market,
    symbol: normalizeSymbol(args.symbol),
    timeframe: args.timeframe,
    limit: String(cappedLimit),
  });
  if (Number.isFinite(Number(args.fromSec))) query.set('from', String(Math.floor(Number(args.fromSec))));
  if (Number.isFinite(Number(args.toSec))) query.set('to', String(Math.floor(Number(args.toSec))));

  const response = await fetch(`${resolveGatewayBaseUrl()}/report/candles?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: args.signal,
  });
  if (!response.ok) {
    throw new Error(`Gateway report candles error: ${response.status}`);
  }
  const json = await response.json() as { candles?: unknown };
  return sanitizeGatewayCandles(json.candles);
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
  let socket: WebSocket | null = null;
  let connecting = false;
  let fetchGeneration = 0;
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

  const cancelActiveFetch = () => {
    fetchGeneration += 1;
    stopFetch();
    connecting = false;
  };

  const stopSocket = () => {
    if (!socket) return;
    try {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    } catch {
      // Ignore close errors.
    }
    socket = null;
  };

  const toWebSocketBaseUrl = (baseUrl: string): string => {
    if (baseUrl.startsWith('https://')) return `wss://${baseUrl.slice('https://'.length)}`;
    if (baseUrl.startsWith('http://')) return `ws://${baseUrl.slice('http://'.length)}`;
    return baseUrl;
  };

  const applySnapshot = (candles: CandleDataLike[]) => {
    chart.setData(candles);
    onDataApplied?.(candles);
  };

  const applyIncremental = (latestRows: CandleDataLike[]) => {
    const incoming = sanitizeGatewayCandles(latestRows);
    if (!incoming.length) return;

    const current = chart.getCandles();
    if (!current.length) {
      applySnapshot(incoming);
      onLiveTick?.();
      return;
    }

    const hasSameCandleValues = (a: CandleDataLike, b: CandleDataLike): boolean => (
      a.open === b.open
      && a.high === b.high
      && a.low === b.low
      && a.close === b.close
      && a.volume === b.volume
      && a.buyVolume === b.buyVolume
      && a.sellVolume === b.sellVolume
      && a.volumeDelta === b.volumeDelta
      && hasSameFootprint(a.footprint, b.footprint)
    );

    const currentMap = new Map<number, CandleDataLike>();
    current.forEach((row) => currentMap.set(row.time, row));
    const latestTime = current[current.length - 1]?.time ?? -Infinity;
    let hasMiddleRepair = false;
    let hasNewerRows = false;
    let hasLastPatch = false;

    incoming.forEach((row) => {
      const existing = currentMap.get(row.time);
      if (row.time < latestTime && (!existing || !hasSameCandleValues(existing, row))) hasMiddleRepair = true;
      if (row.time > latestTime) hasNewerRows = true;
      if (row.time === latestTime) {
        hasLastPatch = !existing || !hasSameCandleValues(existing, row);
      }
      currentMap.set(row.time, row);
    });

    if (!hasMiddleRepair && !hasNewerRows && !hasLastPatch) return;

    const merged = Array.from(currentMap.values())
      .sort((a, b) => a.time - b.time)
      .slice(-Math.max(1, limit));

    // Full merge keeps polling capable of repairing missing candles inside the visible history.
    if (hasMiddleRepair || (hasNewerRows && current.length + incoming.filter((row) => row.time > latestTime).length > limit)) {
      applySnapshot(merged);
      onLiveTick?.();
      return;
    }

    const sortedIncoming = incoming.slice().sort((a, b) => a.time - b.time);
    let applied = false;
    sortedIncoming.forEach((row) => {
      const latest = chart.getCandles().at(-1);
      if (!latest) return;
      if (row.time === latest.time && !hasSameCandleValues(latest, row)) {
        chart.updateLastCandle({
          open: row.open,
          close: row.close,
          high: row.high,
          low: row.low,
          volume: row.volume,
          buyVolume: row.buyVolume,
          sellVolume: row.sellVolume,
          volumeDelta: row.volumeDelta,
          footprint: cloneFootprint(row.footprint),
        });
        applied = true;
        return;
      }
      if (row.time > latest.time) {
        chart.addNewCandle(row);
        applied = true;
      }
    });
    if (!applied) return;
    onLiveTick?.();
  };

  const pollOnce = async (fullReload: boolean, options: { forceRestart?: boolean } = {}): Promise<boolean> => {
    if (connecting) {
      if (!options.forceRestart) return false;
      cancelActiveFetch();
    }

    const symbol = chart.config.symbol;
    if (disabledSymbols.has(normalizeSymbol(symbol))) {
      if (running) onStatusChange?.('idle');
      return false;
    }

    connecting = true;
    const fetchId = ++fetchGeneration;
    const controller = new AbortController();
    abortController = controller;

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
        controller.signal,
      );

      if (fetchId !== fetchGeneration) return false;

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
      if (fetchId === fetchGeneration && running) {
        onStatusChange?.(chart.getCandles().length ? 'connecting' : 'idle');
      }
      return false;
    } finally {
      if (fetchId === fetchGeneration) {
        abortController = null;
        connecting = false;
      }
    }
  };

  const setupPolling = () => {
    stopPolling();
    stopFastPolling();
    fastSyncConfig = loadGatewayFastSyncConfig();
    const intervalMs = POLL_INTERVAL_MS_BY_TIMEFRAME[chart.config.timeframe] ?? 5_000;
    pollingTimer = window.setInterval(() => {
      if (!running) return;
      void pollOnce(false).then((ok) => {
        if (ok && running && !socket) setupWebSocket();
      });
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
      void pollOnce(false).then((ok) => {
        if (ok && running && !socket) setupWebSocket();
      });
      if (ticks >= fastSyncConfig.ticks) {
        stopFastPolling();
      }
    }, fastSyncConfig.intervalMs);
  };

  const setupWebSocket = () => {
    stopSocket();
    const market = inferGatewayMarket(chart.config.symbol);
    const query = new URLSearchParams({
      market,
      symbol: normalizeSymbol(chart.config.symbol),
      timeframe: chart.config.timeframe,
    });
    socket = new WebSocket(`${toWebSocketBaseUrl(resolveGatewayBaseUrl())}/stream?${query.toString()}`);
    socket.onopen = () => {
      if (running) onStatusChange?.('live');
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { candle?: unknown };
        const rows = sanitizeGatewayCandles(payload.candle ? [payload.candle] : []);
        if (!rows.length) return;
        applyIncremental(rows);
      } catch {
        // Ignore malformed live packets.
      }
    };
    socket.onerror = () => {
      stopSocket();
    };
    socket.onclose = () => {
      socket = null;
    };
  };

  const restart = async (reloadHistory: boolean, options: { forceRestart?: boolean } = {}): Promise<boolean> => {
    onStatusChange?.('connecting');
    if (disabledSymbols.has(normalizeSymbol(chart.config.symbol))) {
      onStatusChange?.('idle');
      return false;
    }
    const ok = await pollOnce(reloadHistory, options);
    if (!running) return false;
    if (ok) setupWebSocket();
    setupPolling();
    return true;
  };

  const start = async (): Promise<boolean> => {
    running = true;
    return restart(true);
  };

  const reload = async (): Promise<boolean> => {
    running = true;
    return restart(true, { forceRestart: true });
  };

  const stop = () => {
    running = false;
    stopPolling();
    stopFastPolling();
    cancelActiveFetch();
    stopSocket();
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
