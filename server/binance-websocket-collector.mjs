const BINANCE_SPOT_REST_BASE_URL = 'https://api.binance.com';
const BINANCE_FUTURES_REST_BASE_URL = 'https://fapi.binance.com';
const BINANCE_SPOT_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const BINANCE_FUTURES_WS_BASE_URL = 'wss://fstream.binance.com/ws';

const DEFAULT_STORED_SYMBOLS = ['BTCUSDT'];

function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parsePositiveInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function resolveBinanceSymbol(rawSymbol) {
  const normalized = normalizeSymbol(rawSymbol);
  if (normalized.endsWith('.P')) {
    return {
      market: 'futures',
      storageSymbol: normalized,
      binanceSymbol: normalized.slice(0, -2).replace(/[^A-Z0-9]/g, ''),
    };
  }
  return {
    market: 'spot',
    storageSymbol: normalized.replace(/[^A-Z0-9]/g, ''),
    binanceSymbol: normalized.replace(/[^A-Z0-9]/g, ''),
  };
}

export function mergeBinanceCollectorConfig(config = {}) {
  const storedSymbols = Array.isArray(config.storedSymbols)
    ? config.storedSymbols.map(normalizeSymbol).filter(Boolean)
    : DEFAULT_STORED_SYMBOLS;
  return {
    storedSymbols: Array.from(new Set(storedSymbols.length ? storedSymbols : DEFAULT_STORED_SYMBOLS)),
    backfillLimit: parsePositiveInt(config.backfillLimit, 3000, 1, 20000),
    reconnectMs: parsePositiveInt(config.reconnectMs, 5000, 1000, 60000),
  };
}

export function parseBinanceKlineRow(row) {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTimeMs = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5]);
  if (![openTimeMs, open, high, low, close, volume].every(Number.isFinite)) return null;
  return {
    time: Math.floor(openTimeMs / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}

export function parseBinanceKlinePayload(payload) {
  const kline = payload?.k && typeof payload.k === 'object' ? payload.k : payload;
  if (!kline || typeof kline !== 'object') return null;
  const openTimeMs = Number(kline.t);
  const open = Number(kline.o);
  const high = Number(kline.h);
  const low = Number(kline.l);
  const close = Number(kline.c);
  const volume = Number(kline.v);
  if (![openTimeMs, open, high, low, close, volume].every(Number.isFinite)) return null;
  return {
    time: Math.floor(openTimeMs / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}

function dedupeCandles(candles) {
  const map = new Map();
  candles.forEach((candle) => {
    map.set(candle.time, candle);
  });
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

async function fetchKlineBatch(fetchFn, market, symbol, limit, endTimeMs) {
  const query = new URLSearchParams({
    symbol,
    interval: '1m',
    limit: String(Math.max(1, Math.min(1000, limit))),
  });
  if (Number.isFinite(endTimeMs)) query.set('endTime', String(endTimeMs));
  const baseUrl = market === 'futures' ? BINANCE_FUTURES_REST_BASE_URL : BINANCE_SPOT_REST_BASE_URL;
  const apiPath = market === 'futures' ? 'fapi/v1' : 'api/v3';
  const response = await fetchFn(`${baseUrl}/${apiPath}/klines?${query.toString()}`);
  if (!response.ok) throw new Error(`Binance kline REST error: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Binance kline REST returned non-array payload');
  return rows.map(parseBinanceKlineRow).filter((row) => row != null);
}

export async function fetchBinanceOneMinuteHistory({
  fetchFn = globalThis.fetch,
  market = 'spot',
  symbol,
  limit = 3000,
}) {
  if (typeof fetchFn !== 'function') throw new Error('fetch is not available');
  const target = Math.max(1, Math.min(20000, Math.floor(Number(limit) || 3000)));
  const out = [];
  let remaining = target;
  let endTimeMs;
  while (remaining > 0) {
    const batchLimit = Math.min(1000, remaining);
    const rows = await fetchKlineBatch(fetchFn, market, symbol, batchLimit, endTimeMs);
    if (!rows.length) break;
    out.unshift(...rows);
    remaining -= rows.length;
    endTimeMs = rows[0].time * 1000 - 1;
    if (rows.length < batchLimit) break;
  }
  return dedupeCandles(out).slice(-target);
}

export function createBinanceWebSocketCollector({
  config = {},
  getStoredSymbols,
  applyHistoricalCandles,
  applyLiveCandle,
  fetchFn = globalThis.fetch,
  WebSocketCtor = globalThis.WebSocket,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger = console,
}) {
  let collectorConfig = mergeBinanceCollectorConfig(config);
  let stopped = true;
  let reconnectTimer = null;
  const sockets = new Map();

  const closeSockets = () => {
    for (const socket of sockets.values()) {
      try {
        socket.close();
      } catch {
        // Ignore close failures during reconnect.
      }
    }
    sockets.clear();
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer != null) return;
    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      void connectAll();
    }, collectorConfig.reconnectMs);
  };

  const resolveEnabledSymbols = () => {
    const configured = typeof getStoredSymbols === 'function' ? getStoredSymbols() : collectorConfig.storedSymbols;
    const source = Array.isArray(configured) && configured.length ? configured : collectorConfig.storedSymbols;
    return Array.from(new Set(source.map(normalizeSymbol).filter(Boolean)));
  };

  const backfill = async (resolved) => {
    if (typeof applyHistoricalCandles !== 'function') return;
    try {
      const candles = await fetchBinanceOneMinuteHistory({
        fetchFn,
        market: resolved.market,
        symbol: resolved.binanceSymbol,
        limit: collectorConfig.backfillLimit,
      });
      if (candles.length) {
        applyHistoricalCandles('crypto', resolved.storageSymbol, '1m', candles);
      }
    } catch (error) {
      logger.warn?.(`[binance-ws] ${resolved.storageSymbol} backfill failed: ${error.message}`);
    }
  };

  const openSocket = (resolved) => {
    if (typeof WebSocketCtor !== 'function') {
      logger.error?.('[binance-ws] global WebSocket is not available in this Node runtime');
      return;
    }
    const baseUrl = resolved.market === 'futures' ? BINANCE_FUTURES_WS_BASE_URL : BINANCE_SPOT_WS_BASE_URL;
    const stream = `${resolved.binanceSymbol.toLowerCase()}@kline_1m`;
    const socket = new WebSocketCtor(`${baseUrl}/${stream}`);
    sockets.set(resolved.storageSymbol, socket);

    socket.addEventListener?.('open', () => {
      logger.log?.(`[binance-ws] subscribed: ${resolved.storageSymbol}`);
    });
    socket.addEventListener?.('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data || ''));
        const candle = parseBinanceKlinePayload(payload);
        if (!candle) return;
        applyLiveCandle?.('crypto', resolved.storageSymbol, '1m', candle);
      } catch {
        // Ignore malformed packets.
      }
    });
    socket.addEventListener?.('error', (error) => {
      logger.error?.(`[binance-ws] ${resolved.storageSymbol} socket error:`, error?.message || error);
    });
    socket.addEventListener?.('close', () => {
      sockets.delete(resolved.storageSymbol);
      scheduleReconnect();
    });
  };

  async function connectAll() {
    if (stopped) return;
    closeSockets();
    collectorConfig = mergeBinanceCollectorConfig(config);
    const enabledSymbols = resolveEnabledSymbols();
    if (!enabledSymbols.length) return;

    for (const symbol of enabledSymbols) {
      const resolved = resolveBinanceSymbol(symbol);
      if (!resolved.binanceSymbol) continue;
      await backfill(resolved);
      if (!stopped) openSocket(resolved);
    }
  }

  return {
    start() {
      stopped = false;
      void connectAll();
    },
    stop() {
      stopped = true;
      if (reconnectTimer != null) {
        clearTimeoutFn(reconnectTimer);
        reconnectTimer = null;
      }
      closeSockets();
    },
    resubscribe() {
      void connectAll();
    },
    getStatus() {
      return {
        enabledSymbols: resolveEnabledSymbols(),
        activeSockets: Array.from(sockets.keys()),
        backfillLimit: collectorConfig.backfillLimit,
      };
    },
  };
}
