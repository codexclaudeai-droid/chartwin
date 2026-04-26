import { getStore } from '@netlify/blobs';

const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];

function normalizeMarket(input) {
  const m = String(input || '').trim().toLowerCase();
  return ALLOWED_MARKETS.includes(m) ? m : null;
}
function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}
function canonicalizeSymbol(market, symbol) {
  const s = normalizeSymbol(symbol);
  if (market === 'index' && (s === 'NAS100' || s === 'NQ')) return 'NQ1!';
  return s;
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
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }
  if (request.method !== 'GET') return json(405, { ok: false, message: 'method not allowed' });

  const url = new URL(request.url);
  const market = normalizeMarket(url.searchParams.get('market'));
  const symbol = canonicalizeSymbol(market, url.searchParams.get('symbol') || '');
  const timeframe = String(url.searchParams.get('timeframe') || '1m').trim();
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.floor(limitRaw))) : 300;

  if (!market || !symbol || !timeframe) {
    return json(400, { ok: false, message: 'market/symbol/timeframe required' });
  }

  const store = getStore('candles');
  const key = `${market}:${symbol}:${timeframe}`;
  let candles = [];
  try {
    const raw = await store.get(key, { type: 'json' });
    if (Array.isArray(raw)) candles = raw;
  } catch { candles = []; }

  return json(200, { ok: true, market, symbol, timeframe, candles: candles.slice(-limit) });
}

export const config = { path: '/candles' };
