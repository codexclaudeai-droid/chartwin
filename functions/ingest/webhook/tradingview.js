const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const MAX_CANDLES = 3000;
const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];
const FX_QUOTES = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];
const TF_SECONDS = {
  '1s': 1, '1m': 60, '3m': 180, '5m': 300, '15m': 900,
  '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400,
  '1d': 86400, '1w': 604800, '1M': 2592000,
};

function norm(s) { return String(s || '').trim().toUpperCase().replace(/\s+/g, ''); }

function inferMarket(symbol) {
  const u = norm(symbol);
  if (/^(XAU|XAG|XPT|USO|WTI|BRENT)/.test(u)) return 'commodity';
  if (/^[A-Z]{6}$/.test(u) && FX_QUOTES.includes(u.slice(0, 3)) && FX_QUOTES.includes(u.slice(3))) return 'fx';
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NAS100|NQ1!|NDX|HSI|DAX|NIKKEI|KOSPI|KOSPI200|KOSDAQ)$/.test(u)) return 'index';
  return 'futures';
}

function canonicalize(market, symbol) {
  const s = norm(symbol);
  if (market === 'index' && (s === 'NAS100' || s === 'NQ')) return 'NQ1!';
  return s;
}

function parseTimeSec(v) {
  if (typeof v === 'number' && isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  if (typeof v === 'string') {
    const n = Number(v.trim());
    if (isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
    const ms = Date.parse(v.trim());
    if (isFinite(ms)) return Math.floor(ms / 1000);
  }
  return NaN;
}

function floorBucket(t, tf) {
  const s = TF_SECONDS[tf];
  if (!s || s <= 1) return Math.floor(t);
  return Math.floor(t / s) * s;
}

function sanitize(rows, tf) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const close = Number(r.close);
    if (!isFinite(close)) continue;
    const open = isFinite(Number(r.open)) ? Number(r.open) : close;
    const high = isFinite(Number(r.high)) ? Number(r.high) : close;
    const low  = isFinite(Number(r.low))  ? Number(r.low)  : close;
    const vol  = isFinite(Number(r.volume)) ? Number(r.volume) : 0;
    const time = floorBucket(parseTimeSec(r.time), tf);
    if (!isFinite(time)) continue;
    out.push({ time: Math.floor(time), open, high, low, close, volume: vol });
  }
  const map = new Map();
  out.sort((a, b) => a.time - b.time).forEach(c => map.set(c.time, c));
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, message: 'invalid json' }, { status: 400, headers: CORS }); }

  const expected = env.WEBHOOK_PASSPHRASE || '';
  if (!expected || String(body.passphrase || '') !== expected) {
    return Response.json({ ok: false, message: 'invalid passphrase' }, { status: 401, headers: CORS });
  }

  const market = (ALLOWED_MARKETS.includes(String(body.market || '').toLowerCase())
    ? String(body.market).toLowerCase() : null) || inferMarket(body.symbol);
  const symbol = canonicalize(market, body.symbol);
  const timeframe = String(body.timeframe || body.interval || '1m').trim();
  const candles = sanitize(body.candles, timeframe);

  if (!market || !symbol || !timeframe || !candles.length) {
    return Response.json({ ok: false, message: 'market/symbol/timeframe/candles required' }, { status: 400, headers: CORS });
  }

  try {
    const hidden = await env.CANDLES_KV.get('admin:hidden-symbols', { type: 'json' });
    if (Array.isArray(hidden) && hidden.map(s => String(s).toUpperCase()).includes(symbol)) {
      return Response.json({ ok: false, message: 'symbol disabled' }, { status: 403, headers: CORS });
    }
  } catch {}

  const key = `${market}:${symbol}:${timeframe}`;
  let existing = [];
  try {
    const raw = await env.CANDLES_KV.get(key, { type: 'json' });
    if (Array.isArray(raw)) existing = raw;
  } catch {}

  const map = new Map(existing.map(c => [c.time, c]));
  candles.forEach(c => map.set(c.time, c));
  const merged = Array.from(map.values()).sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);

  await env.CANDLES_KV.put(key, JSON.stringify(merged));

  return Response.json({ ok: true, accepted: candles.length, stored: merged.length, market, symbol, timeframe }, { headers: CORS });
}
