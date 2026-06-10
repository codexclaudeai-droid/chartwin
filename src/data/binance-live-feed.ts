import { TIMEFRAME_SECONDS, type TimeframeKey } from '../catalog/time';
import {
  applyFootprintTrade,
  getFootprintTradeSide,
  type FootprintTradeSide,
} from '../chart/footprint/footprint-aggregation.ts';
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
  updateLastCandle: (patch: Partial<Pick<CandleDataLike, 'close' | 'high' | 'low' | 'volume' | 'buyVolume' | 'sellVolume' | 'volumeDelta' | 'footprint'>>) => void;
};

type CreateBinanceLiveFeedArgs = {
  chart: ChartLike;
  onDataApplied?: (candles: CandleDataLike[]) => void;
  onLiveTick?: () => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'live' | 'fallback') => void;
  limit?: number;
};

export const BINANCE_DIRECT_INITIAL_HISTORY_LIMIT = 3000;
export const BINANCE_DIRECT_OLDER_HISTORY_BATCH = 1000;
export const BINANCE_DIRECT_MAX_RENDER_CANDLES = 9000;
export const BINANCE_DIRECT_MAX_HISTORY_CANDLES = 50000;

const INTERVAL_BY_TIMEFRAME: Partial<Record<TimeframeKey, string>> = {
  '1s': '1s',
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
};

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function resolveBinanceMarketSymbol(rawSymbol: string): { market: 'spot' | 'futures'; symbol: string } {
  const upper = rawSymbol.trim().toUpperCase();
  if (upper.endsWith('.P')) {
    return {
      market: 'futures',
      symbol: normalizeSymbol(upper.slice(0, -2)),
    };
  }
  return {
    market: 'spot',
    symbol: normalizeSymbol(upper),
  };
}

function timeframeToInterval(timeframe: TimeframeKey): string | null {
  return INTERVAL_BY_TIMEFRAME[timeframe] ?? null;
}

function parseTradeRow(row: unknown): { id: number; timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null } | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as Record<string, unknown>;
  const tradeTimeMs = Number(value.time ?? value.T);
  const price = Number(value.price ?? value.p);
  const qty = Number(value.qty ?? value.q);
  const id = Number(value.id ?? value.a);
  const makerValue = value.isBuyerMaker ?? value.m;
  const isBuyerMaker = typeof makerValue === 'boolean' ? makerValue : null;
  if (![tradeTimeMs, price, qty, id].every((v) => Number.isFinite(v))) return null;
  return {
    id,
    timeSec: Math.floor(tradeTimeMs / 1000),
    price,
    qty,
    isBuyerMaker,
  };
}

function parseKlineRow(row: unknown): CandleDataLike | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTimeMs = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5]);
  if (![openTimeMs, open, high, low, close, volume].every((v) => Number.isFinite(v))) return null;
  return {
    time: Math.floor(openTimeMs / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}

async function fetchBinanceKlines(
  market: 'spot' | 'futures',
  symbol: string,
  interval: string,
  limit: number,
  signal: AbortSignal,
  endTimeMs?: number,
): Promise<CandleDataLike[]> {
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.max(1, Math.min(1000, limit))),
  });
  if (Number.isFinite(endTimeMs)) {
    query.set('endTime', String(endTimeMs));
  }
  const endpoint = market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/klines?${query.toString()}`
    : `https://api.binance.com/api/v3/klines?${query.toString()}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    signal,
  });
  if (!response.ok) {
    throw new Error(`Binance REST error: ${response.status}`);
  }
  const rows = (await response.json()) as unknown[];
  const parsed = rows.map(parseKlineRow).filter((row): row is CandleDataLike => row != null);
  if (!parsed.length) throw new Error('Binance REST returned empty candles');
  return parsed;
}

async function fetchRecentTrades(
  market: 'spot' | 'futures',
  symbol: string,
  limit: number,
  signal: AbortSignal,
  endTimeMs?: number,
): Promise<Array<{ id: number; timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null }>> {
  const query = new URLSearchParams({
    symbol,
    limit: String(Math.max(200, Math.min(1000, limit))),
  });
  if (Number.isFinite(endTimeMs)) {
    query.set('endTime', String(endTimeMs));
  }
  const endpoint = market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/aggTrades?${query.toString()}`
    : `https://api.binance.com/api/v3/aggTrades?${query.toString()}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    signal,
  });
  if (!response.ok) throw new Error(`Binance aggTrades REST error: ${response.status}`);
  const rows = (await response.json()) as unknown[];
  const trades = rows.map(parseTradeRow).filter((trade): trade is { id: number; timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null } => trade != null);
  if (!trades.length) throw new Error('Binance aggTrades REST returned empty trades');
  return trades;
}

function getTradeDelta(qty: number, isBuyerMaker: boolean | null): { buyVolume: number; sellVolume: number; volumeDelta: number } {
  if (isBuyerMaker === true) {
    return { buyVolume: 0, sellVolume: qty, volumeDelta: -qty };
  }
  if (isBuyerMaker === false) {
    return { buyVolume: qty, sellVolume: 0, volumeDelta: qty };
  }
  return { buyVolume: 0, sellVolume: 0, volumeDelta: 0 };
}

function applyTradeFootprint(
  levels: FootprintPriceLevel[] | undefined,
  price: number,
  qty: number,
  side: FootprintTradeSide,
): FootprintPriceLevel[] {
  return applyFootprintTrade(levels, {
    price,
    quantity: qty,
    side,
  });
}

function bucketTradeTimeSec(timeSec: number, timeframe: TimeframeKey): number {
  const bucketSec = TIMEFRAME_SECONDS[timeframe] ?? 60;
  return Math.floor(timeSec / bucketSec) * bucketSec;
}

function buildSecondCandlesFromTrades(trades: Array<{ timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null }>): CandleDataLike[] {
  const out: CandleDataLike[] = [];
  trades.forEach((trade) => {
    const delta = getTradeDelta(trade.qty, trade.isBuyerMaker);
    const last = out[out.length - 1];
    if (!last || trade.timeSec > last.time) {
      if (last && trade.timeSec > last.time + 1) {
        for (let sec = last.time + 1; sec < trade.timeSec; sec += 1) {
          out.push({
            time: sec,
            open: last.close,
            high: last.close,
            low: last.close,
            close: last.close,
            volume: 0,
            buyVolume: 0,
            sellVolume: 0,
            volumeDelta: 0,
          });
        }
      }
      out.push({
        time: trade.timeSec,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.qty,
        buyVolume: delta.buyVolume,
        sellVolume: delta.sellVolume,
        volumeDelta: delta.volumeDelta,
      });
      return;
    }
    if (trade.timeSec === last.time) {
      last.high = Math.max(last.high, trade.price);
      last.low = Math.min(last.low, trade.price);
      last.close = trade.price;
      last.volume += trade.qty;
      last.buyVolume = (last.buyVolume ?? 0) + delta.buyVolume;
      last.sellVolume = (last.sellVolume ?? 0) + delta.sellVolume;
      last.volumeDelta = (last.volumeDelta ?? 0) + delta.volumeDelta;
    }
  });
  return out;
}

function dedupeCandles(candles: CandleDataLike[]): CandleDataLike[] {
  const map = new Map<number, CandleDataLike>();
  candles.forEach((candle) => {
    map.set(candle.time, candle);
  });
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

async function fetchBinanceKlinesHistory(
  market: 'spot' | 'futures',
  symbol: string,
  interval: string,
  totalLimit: number,
  signal: AbortSignal,
): Promise<CandleDataLike[]> {
  const target = Math.max(100, Math.min(BINANCE_DIRECT_INITIAL_HISTORY_LIMIT, totalLimit));
  let remaining = target;
  let endTimeMs: number | undefined = undefined;
  const out: CandleDataLike[] = [];

  while (remaining > 0) {
    const batchLimit = Math.min(1000, remaining);
    const rows = await fetchBinanceKlines(market, symbol, interval, batchLimit, signal, endTimeMs);
    if (!rows.length) break;
    out.unshift(...rows);
    remaining -= rows.length;
    const first = rows[0];
    if (!first) break;
    endTimeMs = first.time * 1000 - 1;
    if (rows.length < batchLimit) break;
  }

  const unique = dedupeCandles(out);
  if (!unique.length) throw new Error('Binance REST returned empty candles');
  return unique;
}

async function fetchBinanceKlinesOlder(
  market: 'spot' | 'futures',
  symbol: string,
  interval: string,
  beforeTimeSec: number,
  signal: AbortSignal,
): Promise<CandleDataLike[]> {
  if (!Number.isFinite(beforeTimeSec) || beforeTimeSec <= 0) return [];
  const rows = await fetchBinanceKlines(
    market,
    symbol,
    interval,
    BINANCE_DIRECT_OLDER_HISTORY_BATCH,
    signal,
    beforeTimeSec * 1000 - 1,
  );
  return rows.filter((row) => row.time < beforeTimeSec);
}

async function fetchRecentTradesHistory(
  market: 'spot' | 'futures',
  symbol: string,
  totalLimit: number,
  signal: AbortSignal,
): Promise<Array<{ timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null }>> {
  const target = Math.max(1000, Math.min(20000, totalLimit));
  let remaining = target;
  let endTimeMs: number | undefined = undefined;
  const out: Array<{ id: number; timeSec: number; price: number; qty: number; isBuyerMaker: boolean | null }> = [];

  while (remaining > 0) {
    const batchLimit = Math.min(1000, remaining);
    const rows = await fetchRecentTrades(market, symbol, batchLimit, signal, endTimeMs);
    if (!rows.length) break;
    out.unshift(...rows);
    remaining -= rows.length;
    const minTimeSec = Math.min(...rows.map((item) => item.timeSec));
    endTimeMs = minTimeSec * 1000 - 1;
    if (rows.length < batchLimit) break;
  }

  const unique = Array.from(new Map(out.map((item) => [item.id, item])).values())
    .sort((a, b) => a.timeSec - b.timeSec)
    .map(({ timeSec, price, qty, isBuyerMaker }) => ({ timeSec, price, qty, isBuyerMaker }));
  if (!unique.length) throw new Error('Binance aggTrades REST returned empty trades');
  return unique;
}

export function createBinanceLiveFeed({
  chart,
  onDataApplied,
  onLiveTick,
  onStatusChange,
  limit = 500,
}: CreateBinanceLiveFeedArgs): {
  start: () => Promise<boolean>;
  reload: () => Promise<boolean>;
  loadOlder: () => Promise<boolean>;
  stop: () => void;
} {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let abortController: AbortController | null = null;
  let olderAbortController: AbortController | null = null;
  let running = false;
  let connecting = false;
  let loadingOlder = false;
  let secondMode = false;

  const cleanupSocket = () => {
    if (!socket) return;
    try {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    } catch {
      // ignore
    }
    socket = null;
  };

  const cleanupReconnectTimer = () => {
    if (reconnectTimer == null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const cleanupFetch = () => {
    if (!abortController) return;
    abortController.abort();
    abortController = null;
  };

  const cleanupOlderFetch = () => {
    if (!olderAbortController) return;
    olderAbortController.abort();
    olderAbortController = null;
  };

  const scheduleReconnect = () => {
    cleanupReconnectTimer();
    reconnectTimer = window.setTimeout(() => {
      if (!running) return;
      void restart(false);
    }, 1500);
  };

  const applyLiveKline = (kline: Record<string, unknown>) => {
    const openTimeMs = Number(kline.t);
    const open = Number(kline.o);
    const high = Number(kline.h);
    const low = Number(kline.l);
    const close = Number(kline.c);
    const volume = Number(kline.v);
    if (![openTimeMs, open, high, low, close, volume].every((v) => Number.isFinite(v))) return;

    const nextCandle: CandleDataLike = {
      time: Math.floor(openTimeMs / 1000),
      open,
      high,
      low,
      close,
      volume,
    };
    const candles = chart.getCandles();
    const last = candles[candles.length - 1];
    if (!last) {
      chart.setData([nextCandle]);
      onDataApplied?.([nextCandle]);
      onLiveTick?.();
      return;
    }
    if (nextCandle.time > last.time) {
      chart.addNewCandle(nextCandle);
      onLiveTick?.();
      return;
    }
    if (nextCandle.time === last.time) {
      chart.updateLastCandle({
        close: nextCandle.close,
        high: nextCandle.high,
        low: nextCandle.low,
        volume: nextCandle.volume,
      });
      onLiveTick?.();
    }
  };

  const applyTradeTick = (price: number, qty: number, tradeTimeSec: number, isBuyerMaker: boolean | null) => {
    if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(tradeTimeSec)) return;
    const bucketTimeSec = bucketTradeTimeSec(tradeTimeSec, chart.config.timeframe);
    const delta = getTradeDelta(qty, isBuyerMaker);
    const side = getFootprintTradeSide(isBuyerMaker);
    const candles = chart.getCandles();
    const last = candles[candles.length - 1];
    if (!last) {
      const first: CandleDataLike = {
        time: bucketTimeSec,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
        buyVolume: delta.buyVolume,
        sellVolume: delta.sellVolume,
        volumeDelta: delta.volumeDelta,
        footprint: applyTradeFootprint(undefined, price, qty, side),
      };
      chart.setData([first]);
      onDataApplied?.([first]);
      onLiveTick?.();
      return;
    }
    if (bucketTimeSec > last.time) {
      const bucketSec = TIMEFRAME_SECONDS[chart.config.timeframe] ?? 60;
      if (bucketTimeSec > last.time + bucketSec) {
        for (let sec = last.time + bucketSec; sec < bucketTimeSec; sec += bucketSec) {
          chart.addNewCandle({
            time: sec,
            open: last.close,
            high: last.close,
            low: last.close,
            close: last.close,
            volume: 0,
            buyVolume: 0,
            sellVolume: 0,
            volumeDelta: 0,
          });
        }
      }
      chart.addNewCandle({
        time: bucketTimeSec,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
        volume: qty,
        buyVolume: delta.buyVolume,
        sellVolume: delta.sellVolume,
        volumeDelta: delta.volumeDelta,
        footprint: applyTradeFootprint(undefined, price, qty, side),
      });
      onLiveTick?.();
      return;
    }
    if (bucketTimeSec === last.time) {
      chart.updateLastCandle({
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        volume: last.volume + qty,
        buyVolume: (last.buyVolume ?? 0) + delta.buyVolume,
        sellVolume: (last.sellVolume ?? 0) + delta.sellVolume,
        volumeDelta: (last.volumeDelta ?? 0) + delta.volumeDelta,
        footprint: applyTradeFootprint(last.footprint, price, qty, side),
      });
      onLiveTick?.();
    }
  };

  const connectKlineWebSocket = (market: 'spot' | 'futures', symbol: string, interval: string) => {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${stream}`
      : `wss://stream.binance.com:9443/ws/${stream}`;
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      onStatusChange?.('live');
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { k?: Record<string, unknown> };
        if (!payload?.k) return;
        applyLiveKline(payload.k);
      } catch {
        // ignore malformed packets
      }
    };
    socket.onerror = () => {
      cleanupSocket();
      if (running) scheduleReconnect();
    };
    socket.onclose = () => {
      cleanupSocket();
      if (running) scheduleReconnect();
    };
  };

  const connectTradeWebSocket = (market: 'spot' | 'futures', symbol: string) => {
    const stream = `${symbol.toLowerCase()}@aggTrade`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${stream}`
      : `wss://stream.binance.com:9443/ws/${stream}`;
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      onStatusChange?.('live');
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
        const price = Number(payload.p);
        const qty = Number(payload.q);
        const tradeTimeMs = Number(payload.T);
        const makerValue = payload.m;
        const isBuyerMaker = typeof makerValue === 'boolean' ? makerValue : null;
        if (![price, qty, tradeTimeMs].every((v) => Number.isFinite(v))) return;
        applyTradeTick(price, qty, Math.floor(tradeTimeMs / 1000), isBuyerMaker);
      } catch {
        // ignore malformed packets
      }
    };
    socket.onerror = () => {
      cleanupSocket();
      if (running) scheduleReconnect();
    };
    socket.onclose = () => {
      cleanupSocket();
      if (running) scheduleReconnect();
    };
  };

  const restart = async (reloadHistory: boolean): Promise<boolean> => {
    if (connecting) return false;
    connecting = true;
    cleanupReconnectTimer();
    cleanupSocket();
    cleanupFetch();

    const resolved = resolveBinanceMarketSymbol(chart.config.symbol);
    const symbol = resolved.symbol;
    const interval = timeframeToInterval(chart.config.timeframe);
    secondMode = chart.config.timeframe === '1s';
    if (!symbol || !interval) {
      connecting = false;
      onStatusChange?.('fallback');
      return false;
    }

    try {
      onStatusChange?.('connecting');
      if (reloadHistory) {
        abortController = new AbortController();
        const candles = secondMode
          ? buildSecondCandlesFromTrades(await fetchRecentTradesHistory(resolved.market, symbol, Math.max(limit, 6000), abortController.signal))
          : await fetchBinanceKlinesHistory(resolved.market, symbol, interval, limit, abortController.signal);
        chart.setData(candles);
        onDataApplied?.(candles);
      }
      if (!running) {
        connecting = false;
        onStatusChange?.('idle');
        return false;
      }
      connectTradeWebSocket(resolved.market, symbol);
      connecting = false;
      return true;
    } catch {
      connecting = false;
      onStatusChange?.('fallback');
      return false;
    } finally {
      abortController = null;
    }
  };

  const start = async (): Promise<boolean> => {
    running = true;
    return restart(true);
  };

  const reload = async (): Promise<boolean> => {
    running = true;
    return restart(true);
  };

  const loadOlder = async (): Promise<boolean> => {
    if (loadingOlder || connecting || secondMode) return false;
    const current = chart.getCandles();
    if (current.length >= BINANCE_DIRECT_MAX_HISTORY_CANDLES) return false;
    const first = current[0];
    if (!first || !Number.isFinite(first.time)) return false;
    const resolved = resolveBinanceMarketSymbol(chart.config.symbol);
    const interval = timeframeToInterval(chart.config.timeframe);
    if (!resolved.symbol || !interval) return false;

    loadingOlder = true;
    cleanupOlderFetch();
    olderAbortController = new AbortController();
    try {
      const older = await fetchBinanceKlinesOlder(
        resolved.market,
        resolved.symbol,
        interval,
        first.time,
        olderAbortController.signal,
      );
      if (!older.length) return false;
      const merged = dedupeCandles([...older, ...current]);
      if (merged.length <= current.length) return false;
      chart.setData(merged);
      onDataApplied?.(merged);
      return true;
    } catch {
      return false;
    } finally {
      loadingOlder = false;
      olderAbortController = null;
    }
  };

  const stop = (): void => {
    running = false;
    cleanupReconnectTimer();
    cleanupSocket();
    cleanupFetch();
    cleanupOlderFetch();
    onStatusChange?.('idle');
  };

  return {
    start,
    reload,
    loadOlder,
    stop,
  };
}
