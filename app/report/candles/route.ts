import {
  MarketCandleRequestError,
  canonicalizeMarketCandleSymbol,
  normalizeMarketCandleMarket,
  normalizeMarketCandleTimeframe,
  selectMarketCandles,
} from '../../../src/server/chart-service/market-candles.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = normalizeMarketCandleMarket(url.searchParams.get('market'));
  const symbol = canonicalizeMarketCandleSymbol(market, url.searchParams.get('symbol'));
  const timeframe = normalizeMarketCandleTimeframe(url.searchParams.get('timeframe') || '1m');
  const limit = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get('limit')) || 5000)));
  const fromSec = url.searchParams.get('from');
  const toSec = url.searchParams.get('to');

  try {
    const candles = await selectMarketCandles({
      market: market ?? '',
      symbol,
      timeframe,
      limit,
      fromSec,
      toSec,
    });
    return Response.json({
      ok: true,
      market,
      symbol,
      timeframe,
      source: 'postgres_market_candles',
      total: candles.length,
      candles,
    });
  } catch (error) {
    return marketCandleErrorResponse(error);
  }
}

function marketCandleErrorResponse(error: unknown): Response {
  if (error instanceof MarketCandleRequestError) {
    return Response.json({ ok: false, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'postgres market candle query failed';
  return Response.json({ ok: false, message: 'postgres market candle query failed', detail: message }, { status: 500 });
}
