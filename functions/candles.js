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
  return s;
}

function shouldFillTimeGaps(market, symbol) {
  return market === 'index' && symbol === 'NQ1!';
}

function fillMissingCandles(rows, timeframe, maxGapBars = 240) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const tfSec = TF_SECONDS[timeframe];
  if (!tfSec || tfSec <= 0 || timeframe === '1w' || timeframe === '1M') return rows;

  const sorted = [...rows].sort((a, b) => a.time - b.time);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = out[out.length - 1];
    const next = sorted[i];
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

function getCandidateKeys(market, symbol, timeframe, requestedSymbol) {
  const keySet = new Set([`${market}:${symbol}:${timeframe}`]);
  const requested = norm(requestedSymbol);
  if (requested && requested !== symbol) keySet.add(`${market}:${requested}:${timeframe}`);

  if (symbol === 'NQ1!' || requested === 'NAS100' || requested === 'NQ') {
    ['index', 'futures'].forEach((candidateMarket) => {
      ['NQ1!', 'NAS100', 'NQ'].forEach((candidateSymbol) => {
        keySet.add(`${candidateMarket}:${candidateSymbol}:${timeframe}`);
      });
    });
  }

  if (market === 'commodity' && /^(XAU|XAG)/.test(symbol)) {
    keySet.add(`index:${symbol}:${timeframe}`);
  }
  if (market === 'commodity' && symbol === 'WTI1!') {
    keySet.add(`commodity:WTI:${timeframe}`);
  }

  return Array.from(keySet);
}

async function getCandleRows(env, market, symbol, timeframe, requestedSymbol) {
  const keys = getCandidateKeys(market, symbol, timeframe, requestedSymbol);
  const errors = [];
  for (const key of keys) {
    try {
      const raw = await env.CANDLES_KV.get(key, { type: 'json' });
      if (Array.isArray(raw) && raw.length > 0) {
        return { rows: raw, key, keys, errors };
      }
    } catch (error) {
      errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { rows: [], key: null, keys, errors };
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
  const requestedSymbol = url.searchParams.get('symbol') || '';
  const symbol = canonicalize(market, requestedSymbol);
  const timeframe = String(url.searchParams.get('timeframe') || '1m').trim();
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 300)));
  const debug = url.searchParams.get('debug') === '1';

  if (!market || !symbol || !timeframe) {
    return Response.json({ ok: false, message: 'market/symbol/timeframe required' }, { status: 400, headers: CORS });
  }

  let candles = [];
  let source = 'stored';
  let matchedKey = null;
  let keysTried = [];
  let readErrors = [];
  try {
    if (timeframe !== '1m') {
      const tfSec = TF_SECONDS[timeframe];
      if (tfSec && tfSec > 60) {
        const result1m = await getCandleRows(env, market, symbol, '1m', requestedSymbol);
        keysTried = result1m.keys;
        readErrors = result1m.errors;
        if (Array.isArray(result1m.rows) && result1m.rows.length > 0) {
          const base1m = shouldFillTimeGaps(market, symbol) ? fillMissingCandles(result1m.rows, '1m') : result1m.rows;
          candles = aggregateFrom1m(base1m, tfSec);
          source = 'aggregated_from_1m';
          matchedKey = result1m.key;
        }
      }
    }
    if (!candles.length) {
      const result = await getCandleRows(env, market, symbol, timeframe, requestedSymbol);
      keysTried = result.keys;
      readErrors = result.errors;
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        candles = result.rows;
        source = 'stored';
        matchedKey = result.key;
      }
    }
  } catch (error) {
    readErrors.push(error instanceof Error ? error.message : String(error));
  }

  const gapFilled = shouldFillTimeGaps(market, symbol);
  if (gapFilled) {
    candles = fillMissingCandles(candles, timeframe);
  }

  const payload = {
    ok: true,
    market,
    symbol,
    timeframe,
    source,
    total: candles.length,
    gapFilled,
    candles: candles.slice(-limit),
  };
  if (debug) {
    payload.debug = {
      matchedKey,
      keysTried,
      readErrors,
      kvBound: Boolean(env.CANDLES_KV),
    };
  }

  return Response.json(
    payload,
    { headers: CORS },
  );
}
