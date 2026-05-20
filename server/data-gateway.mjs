import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createKisWebSocketCollector, hasKisCredentials } from './kis-websocket-collector.mjs';

const PORT = Number(process.env.DATA_GATEWAY_PORT || 8787);
const HOST = process.env.DATA_GATEWAY_HOST || '0.0.0.0';
const CONFIG_PATH = resolve(process.cwd(), 'server/config/runtime-config.json');
const CANDLE_DB_PATH = resolve(process.cwd(), 'server/data/candles-db.json');
const MAX_CANDLES_PER_KEY = 20000;

const ALLOWED_PROVIDERS = ['binance', 'api', 'webhook', 'kis'];
const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];
const DEFAULT_PROVIDER_BY_MARKET = {
  crypto: 'binance',
  futures: 'webhook',
  index: 'webhook',
  commodity: 'webhook',
  fx: 'webhook',
};
const DEFAULT_SYMBOL_PROVIDER_BY_MARKET = {};

/** @typedef {{time:number,open:number,high:number,low:number,close:number,volume:number}} Candle */

/** @type {{adminToken:string, webhookPassphrase:string, providers: Record<string, string>, symbolProviders: Record<string, Record<string, string>>, kis?: Record<string, unknown>}} */
let runtimeConfig;

/** @type {Map<string, Candle[]>} */
const candleStore = new Map();
const streamClients = new Set();
let persistTimer = null;
let kisCollector = null;

function splitCandleKey(key) {
  const parts = String(key || '').split(':');
  if (parts.length < 3) return null;
  const market = parts[0];
  const symbol = parts[1];
  const timeframe = parts.slice(2).join(':');
  if (!market || !symbol || !timeframe) return null;
  return { market, symbol: canonicalizeSymbolByMarket(market, symbol), timeframe };
}

async function persistCandleStore() {
  const serialized = {};
  for (const [key, rows] of candleStore.entries()) {
    serialized[key] = rows;
  }
  await mkdir(dirname(CANDLE_DB_PATH), { recursive: true });
  await writeFile(CANDLE_DB_PATH, JSON.stringify(serialized), 'utf8');
}

function schedulePersistCandleStore() {
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistCandleStore().catch((error) => {
      console.error('[data-gateway] persist candle store failed:', error);
    });
  }, 200);
}

function clampLimit(limitRaw) {
  const limit = Number(limitRaw);
  if (!Number.isFinite(limit)) return 300;
  return Math.max(1, Math.min(5000, Math.floor(limit)));
}

function isRawMode(value) {
  if (value == null) return false;
  const raw = String(value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,x-admin-token',
  });
  res.end(JSON.stringify(payload));
}

function sendWebSocketText(socket, payload) {
  if (!socket || socket.destroyed) return;
  const body = Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x81, body.length]);
  } else if (body.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  socket.write(Buffer.concat([header, body]));
}

function streamKey(market, symbol, timeframe) {
  return candleKey(market, canonicalizeSymbolByMarket(market, symbol), timeframe);
}

function broadcastLiveCandle(market, symbol, timeframe, candle) {
  const key = streamKey(market, symbol, timeframe);
  const message = JSON.stringify({
    type: 'candle',
    market,
    symbol: canonicalizeSymbolByMarket(market, symbol),
    timeframe,
    candle,
  });
  for (const client of streamClients) {
    if (client.key === key) sendWebSocketText(client.socket, message);
  }
}

function normalizeMarket(input) {
  const market = String(input || '').trim().toLowerCase();
  return ALLOWED_MARKETS.includes(market) ? market : null;
}

function normalizeProvider(input) {
  const provider = String(input || '').trim().toLowerCase();
  return ALLOWED_PROVIDERS.includes(provider) ? provider : null;
}

function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

function canonicalizeSymbolByMarket(market, symbol) {
  const normalized = normalizeSymbol(symbol);
  if (market === 'index' && (normalized === 'NAS100' || normalized === 'NQ')) return 'NQ1!';
  if (market === 'index' && normalized === '^IXIC') return 'NASDAQ';
  return normalized;
}

const FX_QUOTES = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];

function inferMarketFromSymbol(symbol) {
  const upper = normalizeSymbol(symbol);
  // commodity
  if (/^(XAU|XAG|XPT|USO|WTI|BRENT)/.test(upper)) return 'commodity';
  // fx: exactly 6 uppercase letters, both halves in FX_QUOTES
  if (/^[A-Z]{6}$/.test(upper)) {
    const base = upper.slice(0, 3);
    const quote = upper.slice(3);
    if (FX_QUOTES.includes(base) && FX_QUOTES.includes(quote)) return 'fx';
  }
  // index
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NAS100|NQ1!|NDX|NASDAQ|\^IXIC|IXIC|HSI|DAX|NIKKEI|KOSPI|KOSDAQ|KOSPI200)$/.test(upper)) return 'index';
  // default
  return 'futures';
}

function normalizeTimeframe(input) {
  return String(input || '').trim();
}

function timeframeToSeconds(timeframe) {
  const map = {
    '1s': 1,
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '1d': 86400,
    '1w': 604800,
    '1M': 2592000,
  };
  return map[timeframe] || null;
}

function parseUnixTimeSec(value) {
  if (value == null) return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.floor(value / 1000);
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return NaN;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      if (numeric > 1e12) return Math.floor(numeric / 1000);
      return Math.floor(numeric);
    }
    const isoMs = Date.parse(raw);
    if (Number.isFinite(isoMs)) return Math.floor(isoMs / 1000);
  }
  return NaN;
}

function floorToBucketSec(timeSec, timeframe) {
  const tfSec = timeframeToSeconds(timeframe);
  if (!Number.isFinite(timeSec) || !tfSec || tfSec <= 1) return Math.floor(timeSec);
  return Math.floor(timeSec / tfSec) * tfSec;
}

function getBucketStartSec(timeSec, timeframe) {
  const sec = Math.floor(timeSec);
  if (!Number.isFinite(sec)) return NaN;
  if (timeframe === '1w') {
    const d = new Date(sec * 1000);
    const day = d.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const mondayUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday, 0, 0, 0, 0);
    return Math.floor(mondayUtcMs / 1000);
  }
  if (timeframe === '1M') {
    const d = new Date(sec * 1000);
    const monthUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
    return Math.floor(monthUtcMs / 1000);
  }
  return floorToBucketSec(sec, timeframe);
}

function canAggregateFromOneMinute(timeframe) {
  if (timeframe === '1m') return false;
  if (timeframe === '1w' || timeframe === '1M') return true;
  const tfSec = timeframeToSeconds(timeframe);
  return Boolean(tfSec && tfSec >= 60);
}

function aggregateCandles(baseCandles, timeframe) {
  if (!Array.isArray(baseCandles) || !baseCandles.length) return [];
  const out = [];
  for (const candle of baseCandles) {
    const bucketTime = getBucketStartSec(candle.time, timeframe);
    if (!Number.isFinite(bucketTime)) continue;
    const last = out[out.length - 1];
    if (!last || last.time !== bucketTime) {
      out.push({
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
      continue;
    }
    last.high = Math.max(last.high, candle.high);
    last.low = Math.min(last.low, candle.low);
    last.close = candle.close;
    last.volume += candle.volume;
  }
  return out;
}

function fillMissingCandles(rows, timeframe, maxGapBars = 180) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const tfSec = timeframeToSeconds(timeframe);
  if (!tfSec || tfSec <= 0) return rows;
  if (timeframe === '1w' || timeframe === '1M') return rows;

  const out = [rows[0]];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = out[out.length - 1];
    const next = rows[i];
    if (!prev || !next) continue;
    const gapSec = next.time - prev.time;
    if (gapSec > tfSec) {
      const missingBars = Math.floor(gapSec / tfSec) - 1;
      if (missingBars > 0 && missingBars <= maxGapBars) {
        for (let j = 1; j <= missingBars; j += 1) {
          out.push({
            time: prev.time + tfSec * j,
            open: prev.close,
            high: prev.close,
            low: prev.close,
            close: prev.close,
            volume: 0,
          });
        }
      }
    }
    out.push(next);
  }
  return out;
}

function candleKey(market, symbol, timeframe) {
  return `${market}:${symbol}:${timeframe}`;
}

function parseBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
      if (raw.length > 1_500_000) {
        rejectBody(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        rejectBody(new Error('invalid json'));
      }
    });
    req.on('error', rejectBody);
  });
}

function sanitizeCandles(rows, timeframe) {
  if (!Array.isArray(rows)) return [];
  const parsed = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const v = row;
      const closeRaw = Number(v.close);
      if (!Number.isFinite(closeRaw)) return null;
      const openRaw = Number(v.open);
      const highRaw = Number(v.high);
      const lowRaw = Number(v.low);
      const open = Number.isFinite(openRaw) ? openRaw : closeRaw;
      const high = Number.isFinite(highRaw) ? highRaw : closeRaw;
      const low = Number.isFinite(lowRaw) ? lowRaw : closeRaw;
      const close = closeRaw;
      const volume = Number(v.volume);
      const rawTimeSec = parseUnixTimeSec(v.time);
      const time = floorToBucketSec(rawTimeSec, timeframe);
      const safeVolume = Number.isFinite(volume) ? volume : 0;
      if (![time, open, high, low, close, safeVolume].every((n) => Number.isFinite(n))) return null;
      return {
        time: Math.floor(time),
        open,
        high,
        low,
        close,
        volume: safeVolume,
      };
    })
    .filter((row) => row != null)
    .sort((a, b) => a.time - b.time);

  const map = new Map();
  parsed.forEach((item) => {
    map.set(item.time, item);
  });
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function upsertCandles(market, symbol, timeframe, incomingCandles) {
  const key = candleKey(market, symbol, timeframe);
  const current = candleStore.get(key) || [];
  const map = new Map(current.map((c) => [c.time, c]));
  incomingCandles.forEach((c) => map.set(c.time, c));
  const merged = Array.from(map.values())
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_CANDLES_PER_KEY);
  candleStore.set(key, merged);
  schedulePersistCandleStore();
  return merged;
}

function mergeLiveCandle(existing, incoming) {
  if (!existing) return { ...incoming };
  return {
    time: existing.time,
    open: Number.isFinite(existing.open) ? existing.open : incoming.open,
    high: Math.max(existing.high, incoming.high, incoming.close),
    low: Math.min(existing.low, incoming.low, incoming.close),
    close: incoming.close,
    volume: Number.isFinite(incoming.volume) ? incoming.volume : existing.volume,
  };
}

function applyLiveCandle(market, symbol, timeframe, incomingCandle) {
  const canonicalSymbol = canonicalizeSymbolByMarket(market, symbol);
  const sanitized = sanitizeCandles([incomingCandle], timeframe);
  const incoming = sanitized[0];
  if (!market || !canonicalSymbol || !timeframe || !incoming) return [];

  const key = candleKey(market, canonicalSymbol, timeframe);
  const current = candleStore.get(key) || [];
  const last = current[current.length - 1];
  let nextRows;
  if (last && last.time === incoming.time) {
    const merged = mergeLiveCandle(last, incoming);
    nextRows = current.slice(0, -1).concat(merged);
    broadcastLiveCandle(market, canonicalSymbol, timeframe, merged);
  } else if (last && incoming.time < last.time) {
    const map = new Map(current.map((candle) => [candle.time, candle]));
    const merged = mergeLiveCandle(map.get(incoming.time), incoming);
    map.set(incoming.time, merged);
    nextRows = Array.from(map.values()).sort((a, b) => a.time - b.time);
    broadcastLiveCandle(market, canonicalSymbol, timeframe, merged);
  } else {
    nextRows = current.concat(incoming);
    broadcastLiveCandle(market, canonicalSymbol, timeframe, incoming);
  }
  const trimmed = nextRows.slice(-MAX_CANDLES_PER_KEY);
  candleStore.set(key, trimmed);
  schedulePersistCandleStore();
  return trimmed;
}

function checkAdmin(req) {
  const token = req.headers['x-admin-token'];
  return typeof token === 'string' && token === runtimeConfig.adminToken;
}

async function loadRuntimeConfig() {
  if (!existsSync(CONFIG_PATH)) {
    runtimeConfig = {
      adminToken: 'change-me-admin-token',
      webhookPassphrase: 'change-me-webhook-passphrase',
      providers: { ...DEFAULT_PROVIDER_BY_MARKET },
      symbolProviders: structuredClone(DEFAULT_SYMBOL_PROVIDER_BY_MARKET),
      kis: {},
    };
    await persistRuntimeConfig();
    return;
  }
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  runtimeConfig = {
    adminToken: String(parsed.adminToken || 'change-me-admin-token'),
    webhookPassphrase: String(parsed.webhookPassphrase || 'change-me-webhook-passphrase'),
    providers: {
      ...DEFAULT_PROVIDER_BY_MARKET,
      ...(parsed.providers && typeof parsed.providers === 'object' ? parsed.providers : {}),
    },
    symbolProviders: mergeSymbolProviders(parsed.symbolProviders),
    kis: parsed.kis && typeof parsed.kis === 'object' ? parsed.kis : {},
  };
}

function mergeSymbolProviders(raw) {
  const merged = structuredClone(DEFAULT_SYMBOL_PROVIDER_BY_MARKET);
  if (!raw || typeof raw !== 'object') return merged;
  for (const [marketRaw, symbolsRaw] of Object.entries(raw)) {
    const market = normalizeMarket(marketRaw);
    if (!market || !symbolsRaw || typeof symbolsRaw !== 'object') continue;
    if (!merged[market]) merged[market] = {};
    for (const [symbolRaw, providerRaw] of Object.entries(symbolsRaw)) {
      const symbol = canonicalizeSymbolByMarket(market, symbolRaw);
      const provider = normalizeProvider(providerRaw);
      if (symbol && provider) merged[market][symbol] = provider;
    }
  }
  return merged;
}

async function loadCandleStore() {
  if (!existsSync(CANDLE_DB_PATH)) return;
  const raw = await readFile(CANDLE_DB_PATH, 'utf8');
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!parsed || typeof parsed !== 'object') return;

  for (const [key, rows] of Object.entries(parsed)) {
    const keyParts = splitCandleKey(key);
    if (!keyParts) continue;
    const sanitized = sanitizeCandles(rows, keyParts.timeframe).slice(-MAX_CANDLES_PER_KEY);
    if (!sanitized.length) continue;
    const canonicalKey = candleKey(
      keyParts.market,
      canonicalizeSymbolByMarket(keyParts.market, keyParts.symbol),
      keyParts.timeframe,
    );
    const existing = candleStore.get(canonicalKey) || [];
    const mergedByTime = new Map(existing.map((candle) => [candle.time, candle]));
    sanitized.forEach((candle) => mergedByTime.set(candle.time, candle));
    const merged = Array.from(mergedByTime.values())
      .sort((a, b) => a.time - b.time)
      .slice(-MAX_CANDLES_PER_KEY);
    candleStore.set(canonicalKey, merged);
  }
}

async function persistRuntimeConfig() {
  await writeFile(CONFIG_PATH, JSON.stringify(runtimeConfig, null, 2), 'utf8');
}

function getProviderForMarket(market, symbol = '') {
  const canonicalSymbol = canonicalizeSymbolByMarket(market, symbol);
  const symbolProvider = runtimeConfig.symbolProviders?.[market]?.[canonicalSymbol];
  if (symbolProvider) return normalizeProvider(symbolProvider) || DEFAULT_PROVIDER_BY_MARKET[market] || 'webhook';
  const fromConfig = runtimeConfig.providers[market];
  return normalizeProvider(fromConfig) || DEFAULT_PROVIDER_BY_MARKET[market] || 'webhook';
}

function getKisEnabledSymbols() {
  const indexProviders = runtimeConfig.symbolProviders?.index || {};
  return Object.entries(indexProviders)
    .filter(([, provider]) => normalizeProvider(provider) === 'kis')
    .map(([symbol]) => canonicalizeSymbolByMarket('index', symbol));
}

function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: 'data-gateway',
    now: new Date().toISOString(),
    markets: runtimeConfig.providers,
    symbolProviders: runtimeConfig.symbolProviders,
    kis: {
      enabledSymbols: getKisEnabledSymbols(),
      credentialsSet: hasKisCredentials(runtimeConfig.kis),
    },
  });
}

function handleGetConfig(req, res) {
  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, message: 'unauthorized' });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    providers: runtimeConfig.providers,
    symbolProviders: runtimeConfig.symbolProviders,
    adminTokenSet: Boolean(runtimeConfig.adminToken),
    webhookPassphraseSet: Boolean(runtimeConfig.webhookPassphrase),
  });
}

async function handleSetProvider(req, res) {
  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, message: 'unauthorized' });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
    return;
  }

  const market = normalizeMarket(body.market);
  const provider = normalizeProvider(body.provider);
  if (!market || !provider) {
    sendJson(res, 400, {
      ok: false,
      message: 'market/provider is invalid',
      allowedMarkets: ALLOWED_MARKETS,
      allowedProviders: ALLOWED_PROVIDERS,
    });
    return;
  }

  runtimeConfig.providers[market] = provider;
  await persistRuntimeConfig();
  sendJson(res, 200, {
    ok: true,
    market,
    provider,
    providers: runtimeConfig.providers,
  });
}

async function handleWebhookIngest(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
    return;
  }

  const passphrase = String(body.passphrase || '');
  if (!passphrase || passphrase !== runtimeConfig.webhookPassphrase) {
    sendJson(res, 401, { ok: false, message: 'invalid passphrase' });
    return;
  }

  const requestedMarket = normalizeMarket(body.market);
  const inferredMarket = inferMarketFromSymbol(body.symbol);
  const market = inferredMarket === 'futures' && requestedMarket ? requestedMarket : inferredMarket;
  const symbol = canonicalizeSymbolByMarket(market, body.symbol);
  const timeframe = normalizeTimeframe(body.timeframe || body.interval || '1m');
  const candles = sanitizeCandles(body.candles, timeframe);

  if (!market || !symbol || !timeframe || candles.length === 0) {
    sendJson(res, 400, {
      ok: false,
      message: 'market/symbol/timeframe/candles is required',
      note: 'candles must include time/open/high/low/close/volume',
    });
    return;
  }

  const selectedProvider = getProviderForMarket(market, symbol);
  if (selectedProvider !== 'webhook') {
    sendJson(res, 409, {
      ok: false,
      message: `market ${market} is currently configured to ${selectedProvider}, not webhook`,
    });
    return;
  }

  const merged = upsertCandles(market, symbol, timeframe, candles);
  sendJson(res, 202, {
    ok: true,
    accepted: candles.length,
    stored: merged.length,
    market,
    symbol,
    timeframe,
    provider: selectedProvider,
  });
}

async function handleApiIngest(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, message: 'unauthorized' });
    return;
  }

  const market = normalizeMarket(body.market);
  const symbol = canonicalizeSymbolByMarket(market, body.symbol);
  const timeframe = normalizeTimeframe(body.timeframe || '1m');
  const candles = sanitizeCandles(body.candles, timeframe);

  if (!market || !symbol || !timeframe || candles.length === 0) {
    sendJson(res, 400, {
      ok: false,
      message: 'market/symbol/timeframe/candles is required',
    });
    return;
  }

  const selectedProvider = getProviderForMarket(market, symbol);
  if (selectedProvider === 'webhook') {
    sendJson(res, 409, {
      ok: false,
      message: `market ${market} is currently configured to webhook, not api/binance`,
    });
    return;
  }

  const merged = upsertCandles(market, symbol, timeframe, candles);
  sendJson(res, 202, {
    ok: true,
    accepted: candles.length,
    stored: merged.length,
    market,
    symbol,
    timeframe,
    provider: selectedProvider,
  });
}

function handleGetCandles(req, res, url) {
  const market = normalizeMarket(url.searchParams.get('market'));
  const symbol = canonicalizeSymbolByMarket(market, url.searchParams.get('symbol'));
  const timeframe = normalizeTimeframe(url.searchParams.get('timeframe') || '1m');
  const limit = clampLimit(url.searchParams.get('limit'));
  const rawMode = isRawMode(url.searchParams.get('raw'));

  if (!market || !symbol || !timeframe) {
    sendJson(res, 400, {
      ok: false,
      message: 'market/symbol/timeframe query is required',
    });
    return;
  }

  const key = candleKey(market, symbol, timeframe);
  const requestedRows = candleStore.get(key) || [];
  const oneMinuteRows = candleStore.get(candleKey(market, symbol, '1m')) || [];
  const aggregatedRows = canAggregateFromOneMinute(timeframe) && oneMinuteRows.length
    ? aggregateCandles(oneMinuteRows, timeframe)
    : requestedRows;
  const normalizedRows = rawMode ? requestedRows : fillMissingCandles(aggregatedRows, timeframe);
  const sliced = normalizedRows.slice(-limit);

  sendJson(res, 200, {
    ok: true,
    market,
    symbol,
    timeframe,
    raw: rawMode,
    source: rawMode ? 'stored' : (aggregatedRows === requestedRows ? 'stored' : 'aggregated_from_1m'),
    provider: getProviderForMarket(market, symbol),
    total: normalizedRows.length,
    candles: sliced,
  });
}

function handleDeleteCandles(req, res, url) {
  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, message: 'unauthorized' });
    return;
  }

  const market = normalizeMarket(url.searchParams.get('market'));
  const symbol = canonicalizeSymbolByMarket(market, url.searchParams.get('symbol'));
  const timeframe = normalizeTimeframe(url.searchParams.get('timeframe') || '1m');

  if (!market || !symbol || !timeframe) {
    sendJson(res, 400, {
      ok: false,
      message: 'market/symbol/timeframe query is required',
    });
    return;
  }

  const key = candleKey(market, symbol, timeframe);
  const existing = candleStore.get(key) || [];
  const removed = existing.length;
  candleStore.delete(key);
  schedulePersistCandleStore();

  sendJson(res, 200, {
    ok: true,
    market,
    symbol,
    timeframe,
    removed,
  });
}

function handleNotFound(res) {
  sendJson(res, 404, {
    ok: false,
    message: 'not found',
    endpoints: [
      'GET /health',
      'GET /admin/config',
      'POST /admin/provider',
      'POST /ingest/webhook/tradingview',
      'POST /ingest/api/candles',
      'GET /candles?market=index&symbol=NQ1!&timeframe=1m&limit=300',
      'DELETE /admin/candles?market=index&symbol=NDX&timeframe=1m',
    ],
  });
}

function handleWebSocketUpgrade(req, socket) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/stream') {
    socket.destroy();
    return;
  }

  const market = normalizeMarket(url.searchParams.get('market'));
  const symbol = canonicalizeSymbolByMarket(market, url.searchParams.get('symbol'));
  const timeframe = normalizeTimeframe(url.searchParams.get('timeframe') || '1m');
  const secKey = req.headers['sec-websocket-key'];
  if (!market || !symbol || !timeframe || typeof secKey !== 'string') {
    socket.destroy();
    return;
  }

  const acceptKey = createHash('sha1')
    .update(`${secKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    '',
  ].join('\r\n'));

  const client = { key: streamKey(market, symbol, timeframe), socket };
  streamClients.add(client);
  socket.on('data', (buffer) => {
    const opcode = Number(buffer?.[0] ?? 0) & 0x0f;
    if (opcode === 0x8) {
      streamClients.delete(client);
      socket.end(Buffer.from([0x88, 0x00]));
    } else if (opcode === 0x9) {
      socket.write(Buffer.from([0x8a, 0x00]));
    }
  });
  socket.on('close', () => streamClients.delete(client));
  socket.on('end', () => streamClients.delete(client));
  socket.on('error', () => streamClients.delete(client));
}

await loadRuntimeConfig();
await loadCandleStore();

kisCollector = createKisWebSocketCollector({
  config: runtimeConfig.kis,
  getEnabledSymbols: getKisEnabledSymbols,
  applyLiveCandle,
});
if (getKisEnabledSymbols().length && hasKisCredentials(runtimeConfig.kis)) {
  kisCollector.start();
} else if (getKisEnabledSymbols().length) {
  console.warn('[data-gateway] KIS symbols are enabled, but KIS credentials are not set. Set KIS_APP_KEY/KIS_APP_SECRET or KIS_WS_APPROVAL_KEY.');
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-token',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    handleHealth(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/admin/config') {
    handleGetConfig(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/admin/provider') {
    await handleSetProvider(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/ingest/webhook/tradingview') {
    await handleWebhookIngest(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/ingest/api/candles') {
    await handleApiIngest(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/candles') {
    handleGetCandles(req, res, url);
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/admin/candles') {
    handleDeleteCandles(req, res, url);
    return;
  }

  handleNotFound(res);
});

server.on('upgrade', handleWebSocketUpgrade);

server.listen(PORT, HOST, () => {
  console.log(`[data-gateway] listening on http://${HOST}:${PORT}`);
});
