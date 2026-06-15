import {
  MarketCandleRequestError,
  canonicalizeMarketCandleSymbol,
  normalizeMarketCandleMarket,
  normalizeMarketCandleTimeframe,
  upsertMarketCandles,
} from '../../../../src/server/chart-service/market-candles.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, message: 'invalid json' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const passphrase = String(payload.passphrase || '');
  if (!isValidWebhookPassphrase(passphrase)) {
    return Response.json({ ok: false, message: 'invalid passphrase' }, { status: 401 });
  }

  const requestedMarket = normalizeMarketCandleMarket(payload.market);
  const inferredMarket = inferMarketFromSymbol(payload.symbol);
  const market = inferredMarket === 'futures' && requestedMarket ? requestedMarket : inferredMarket;
  const symbol = canonicalizeMarketCandleSymbol(market, payload.symbol);
  const timeframe = normalizeMarketCandleTimeframe(payload.timeframe || payload.interval || '1m');
  const candles = Array.isArray(payload.candles) ? payload.candles : [];

  try {
    const accepted = await upsertMarketCandles({
      market: market ?? '',
      symbol,
      timeframe,
      candles,
    });
    return Response.json({
      ok: true,
      accepted,
      stored: accepted,
      market,
      symbol,
      timeframe,
      provider: 'webhook',
    }, { status: 202 });
  } catch (error) {
    return marketCandleErrorResponse(error);
  }
}

function isValidWebhookPassphrase(passphrase: string): boolean {
  const expected = String(
    process.env.CHART_SERVICE_WEBHOOK_PASSPHRASE
      || process.env.DATA_GATEWAY_WEBHOOK_PASSPHRASE
      || process.env.WEBHOOK_PASSPHRASE
      || '7SGMie3m/XVQh3PgC+iehsBkFgfoGpde3RWnpmThgOyOEaVgNuQFQPmSSmTb/rMC',
  );
  return Boolean(passphrase && expected && passphrase === expected);
}

function inferMarketFromSymbol(symbol: unknown): string | null {
  const upper = String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^(XAU|XAG|XPT|USO|WTI|BRENT)/.test(upper)) return 'commodity';
  if (/^[A-Z]{6}$/.test(upper)) {
    const fxQuotes = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];
    if (fxQuotes.includes(upper.slice(0, 3)) && fxQuotes.includes(upper.slice(3))) return 'fx';
  }
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NAS100|NQ1!|NDX|NASDAQ|\^IXIC|IXIC|HSI|DAX|NIKKEI|KOSPI|KOSDAQ|KOSPI200)$/.test(upper)) {
    return 'index';
  }
  return 'futures';
}

function marketCandleErrorResponse(error: unknown): Response {
  if (error instanceof MarketCandleRequestError) {
    return Response.json({ ok: false, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'webhook candle ingest failed';
  return Response.json({ ok: false, message: 'webhook candle ingest failed', detail: message }, { status: 500 });
}
