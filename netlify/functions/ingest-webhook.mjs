import { getStore } from '@netlify/blobs';

const MAX_CANDLES = 3000;
const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];
const FX_QUOTES = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];
const TIMEFRAME_SECONDS = {
  '1s': 1, '1m': 60, '3m': 180, '5m': 300, '15m': 900,
  '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400,
  '1d': 86400, '1w': 604800, '1M': 2592000,
};

function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}
function normalizeMarket(input) {
  const m = String(input || '').trim().toLowerCase();
  return ALLOWED_MARKETS.includes(m) ? m : null;
}
function canonicalizeSymbol(market, symbol) {
  const s = normalizeSymbol(symbol);
  if (market === 'index' && (s === 'NAS100' || s === 'NQ')) return 'NQ1!';
  return s;
}
function inferMarketFromSymbol(symbol) {
  const u = normalizeSymbol(symbol);
  if (/^(XAU|XAG|XPT|USO|WTI|BRENT)/.test(u)) return 'commodity';
  if (/^[A-Z]{6}$/.test(u)) {
    if (FX_QUOTES.includes(u.slice(0, 3)) && FX_QUOTES.includes(u.slice(3))) return 'fx';
  }
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NAS100|NQ1!|NDX|HSI|DAX|NIKKEI|KOSPI|KOSPI200|KOSDAQ)$/.test(u)) return 'index';
  return 'futures';
}
function parseUnixTimeSec(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
    const ms = Date.parse(value.trim());
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return NaN;
}
function floorToBucket(timeSec, tf) {
  const s = TIMEFRAME_SECONDS[tf];
  if (!s || s <= 1) return Math.floor(timeSec);
  return Math.floor(timeSec / s) * s;
}
function sanitizeCandles(rows, tf) {
  if (!Array.isArray(rows)) return [];
  const parsed = rows.map((r) => {
    if (!r || typeof r !== 'object') return null;
    const close = Number(r.close);
    if (!Number.isFinite(close)) return null;
    const open = Number.isFinite(Number(r.open)) ? Number(r.open) : close;
    const high = Number.isFinite(Number(r.high)) ? Number(r.high) : close;
    const low = Number.isFinite(Number(r.low)) ? Number(r.low) : close;
    const volume = Number.isFinite(Number(r.volume)) ? Number(r.volume) : 0;
    const time = floorToBucket(parseUnixTimeSec(r.time), tf);
    if (!Number.isFinite(time)) return null;
    return { time: Math.floor(time), open, high, low, close, volume };
  }).filter(Boolean).sort((a, b) => a.time - b.time);
  const map = new Map();
  parsed.forEach((c) => map.set(c.time, c));
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}
function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }
  if (request.method !== 'POST') return json(405, { ok: false, message: 'method not allowed' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, message: 'invalid json' }); }

  const expected = process.env.WEBHOOK_PASSPHRASE || '';
  if (!expected || String(body.passphrase || '') !== expected) {
    return json(401, { ok: false, message: 'invalid passphrase' });
  }

  const market = normalizeMarket(body.market) || inferMarketFromSymbol(body.symbol);
  const symbol = canonicalizeSymbol(market, body.symbol);
  const timeframe = String(body.timeframe || body.interval || '1m').trim();
  const candles = sanitizeCandles(body.candles, timeframe);

  if (!market || !symbol || !timeframe || !candles.length) {
    return json(400, { ok: false, message: 'market/symbol/timeframe/candles required' });
  }

  const store = getStore('candles');
  const key = `${market}:${symbol}:${timeframe}`;
  let existing = [];
  try {
    const raw = await store.get(key, { type: 'json' });
    if (Array.isArray(raw)) existing = raw;
  } catch { existing = []; }

  const mergeMap = new Map(existing.map((c) => [c.time, c]));
  candles.forEach((c) => mergeMap.set(c.time, c));
  const merged = Array.from(mergeMap.values()).sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);

  await store.set(key, JSON.stringify(merged));

  return json(202, { ok: true, accepted: candles.length, stored: merged.length, market, symbol, timeframe });
}

export const config = { path: '/ingest/webhook/tradingview' };
