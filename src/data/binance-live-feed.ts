import type { TimeframeKey } from '../catalog/time';

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

type CreateBinanceLiveFeedArgs = {
  chart: ChartLike;
  onDataApplied?: (candles: CandleDataLike[]) => void;
  onLiveTick?: () => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'live' | 'fallback') => void;
  limit?: number;
};

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

function parseTradeRow(row: unknown): { id: number; timeSec: number; price: number; qty: number } | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as Record<string, unknown>;
  const tradeTimeMs = Number(value.time ?? value.T);
  const price = Number(value.price ?? value.p);
  const qty = Number(value.qty ?? value.q);
  const id = Number(value.id ?? value.a);
  if (![tradeTimeMs, price, qty, id].every((v) => Number.isFinite(v))) return null;
  return {
    id,
    timeSec: Math.floor(tradeTimeMs / 1000),
    price,
    qty,
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
): Promise<Array<{ id: number; timeSec: number; price: number; qty: number }>> {
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
  const trades = rows.map(parseTradeRow).filter((trade): trade is { id: number; timeSec: number; price: number; qty: number } => trade != null);
  if (!trades.length) throw new Error('Binance aggTrades REST returned empty trades');
  return trades;
}

function buildSecondCandlesFromTrades(trades: Array<{ timeSec: number; price: number; qty: number }>): CandleDataLike[] {
  const out: CandleDataLike[] = [];
  trades.forEach((trade) => {
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
      });
      return;
    }
    if (trade.timeSec === last.time) {
      last.high = Math.max(last.high, trade.price);
      last.low = Math.min(last.low, trade.price);
      last.close = trade.price;
      last.volume += trade.qty;
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
  const target = Math.max(100, Math.min(3000, totalLimit));
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

async function fetchRecentTradesHistory(
  market: 'spot' | 'futures',
  symbol: string,
  totalLimit: number,
  signal: AbortSignal,
): Promise<Array<{ timeSec: number; price: number; qty: number }>> {
  const target = Math.max(1000, Math.min(20000, totalLimit));
  let remaining = target;
  let endTimeMs: number | undefined = undefined;
  const out: Array<{ id: number; timeSec: number; price: number; qty: number }> = [];

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
    .map(({ timeSec, price, qty }) => ({ timeSec, price, qty }));
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
  stop: () => void;
} {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let abortController: AbortController | null = null;
  let running = false;
  let connecting = false;
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

  const applyTradeTick = (price: number, qty: number, tradeTimeSec: number) => {
    if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(tradeTimeSec)) return;
    const candles = chart.getCandles();
    const last = candles[candles.length - 1];
    if (!last) {
      const first: CandleDataLike = {
        time: tradeTimeSec,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
      };
      chart.setData([first]);
      onDataApplied?.([first]);
      onLiveTick?.();
      return;
    }
    if (tradeTimeSec > last.time) {
      if (tradeTimeSec > last.time + 1) {
        for (let sec = last.time + 1; sec < tradeTimeSec; sec += 1) {
          chart.addNewCandle({
            time: sec,
            open: last.close,
            high: last.close,
            low: last.close,
            close: last.close,
            volume: 0,
          });
        }
      }
      chart.addNewCandle({
        time: tradeTimeSec,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
        volume: qty,
      });
      onLiveTick?.();
      return;
    }
    if (tradeTimeSec === last.time) {
      chart.updateLastCandle({
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        volume: last.volume + qty,
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
        if (![price, qty, tradeTimeMs].every((v) => Number.isFinite(v))) return;
        applyTradeTick(price, qty, Math.floor(tradeTimeMs / 1000));
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
      if (secondMode) connectTradeWebSocket(resolved.market, symbol);
      else connectKlineWebSocket(resolved.market, symbol, interval);
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

  const stop = (): void => {
    running = false;
    cleanupReconnectTimer();
    cleanupSocket();
    cleanupFetch();
    onStatusChange?.('idle');
  };

  return {
    start,
    reload,
    stop,
  };
}
