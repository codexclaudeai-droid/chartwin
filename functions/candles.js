const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];
const TF_SECONDS = {
  '1s': 1, '1m': 60, '3m': 180, '5m': 300, '15m': 900,
  '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400,
  '1d': 86400, '1w': 604800, '1M': 2592000,
};

function norm(s) { return String(s || '').trim().toUpperCase().replace(/\s+/g, ''); }

function canonicalizeMarketForSymbol(market, symbol) {
  const s = norm(symbol);
  if (market === 'index' && /^(XAU|XAG|XPT|USO|WTI|BRENT)/.test(s)) return 'commodity';
  return market;
}

function canonicalize(market, symbol) {
  const s = norm(symbol);
  if (market === 'index' && (s === 'NAS100' || s === 'NQ')) return 'NQ1!';
  if (market === 'index' && s === '^IXIC') return 'NASDAQ';
  if (market === 'commodity' && s === 'WTI') return 'WTI1!';
  if (market === 'commodity' && (s === 'XAUUSDT' || s === 'XAUUSDT.P')) return 'XAUUSD';
  if (market === 'commodity' && (s === 'XAGUSDT' || s === 'XAGUSDT.P')) return 'XAGUSD';
  return s;
}

async function getCandleRows(env, market, symbol, timeframe) {
  const key = `${market}:${symbol}:${timeframe}`;
  const raw = await env.CANDLES_KV.get(key, { type: 'json' });
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (market === 'commodity' && /^(XAU|XAG)/.test(symbol)) {
    const legacyRaw = await env.CANDLES_KV.get(`index:${symbol}:${timeframe}`, { type: 'json' });
    if (Array.isArray(legacyRaw) && legacyRaw.length > 0) return legacyRaw;
  }
  return [];
}

function aggregateFrom1m(candles1m, targetTfSec) {
  const map = new Map();
  for (const c of candles1m) {
    const bucket = Math.floor(c.time / targetTfSec) * targetTfSec;
    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
      });
    } else {
      if (c.high > existing.high) existing.high = c.high;
      if (c.low < existing.low) existing.low = c.low;
      existing.close = c.close;
      existing.volume = (existing.volume || 0) + (c.volume || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const requestedMarket = ALLOWED_MARKETS.includes(String(url.searchParams.get('market') || '').toLowerCase())
    ? String(url.searchParams.get('market')).toLowerCase() : null;
  const market = requestedMarket ? canonicalizeMarketForSymbol(requestedMarket, url.searchParams.get('symbol') || '') : null;
  const symbol = canonicalize(market, url.searchParams.get('symbol') || '');
  const timeframe = String(url.searchParams.get('timeframe') || '1m').trim();
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 300)));

  if (!market || !symbol || !timeframe) {
    return Response.json({ ok: false, message: 'market/symbol/timeframe required' }, { status: 400, headers: CORS });
  }

  let candles = [];
  let source = 'stored';
  try {
    if (timeframe !== '1m') {
      const tfSec = TF_SECONDS[timeframe];
      if (tfSec && tfSec > 60) {
        const raw1m = await getCandleRows(env, market, symbol, '1m');
        if (Array.isArray(raw1m) && raw1m.length > 0) {
          candles = aggregateFrom1m(raw1m, tfSec);
          source = 'aggregated_from_1m';
        }
      }
    }
    if (!candles.length) {
      const raw = await getCandleRows(env, market, symbol, timeframe);
      if (Array.isArray(raw) && raw.length > 0) {
        candles = raw;
        source = 'stored';
      }
    }
  } catch {}

  return Response.json(
    { ok: true, market, symbol, timeframe, source, candles: candles.slice(-limit) },
    { headers: CORS },
  );
}
