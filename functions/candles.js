const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'];

function norm(s) { return String(s || '').trim().toUpperCase().replace(/\s+/g, ''); }
function canonicalize(market, symbol) {
  const s = norm(symbol);
  if (market === 'index' && (s === 'NAS100' || s === 'NQ')) return 'NQ1!';
  return s;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const market = ALLOWED_MARKETS.includes(String(url.searchParams.get('market') || '').toLowerCase())
    ? String(url.searchParams.get('market')).toLowerCase() : null;
  const symbol = canonicalize(market, url.searchParams.get('symbol') || '');
  const timeframe = String(url.searchParams.get('timeframe') || '1m').trim();
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 300)));

  if (!market || !symbol || !timeframe) {
    return Response.json({ ok: false, message: 'market/symbol/timeframe required' }, { status: 400, headers: CORS });
  }

  const key = `${market}:${symbol}:${timeframe}`;
  let candles = [];
  try {
    const raw = await env.CANDLES_KV.get(key, { type: 'json' });
    if (Array.isArray(raw)) candles = raw;
  } catch {}

  return Response.json(
    { ok: true, market, symbol, timeframe, candles: candles.slice(-limit) },
    { headers: CORS },
  );
}
