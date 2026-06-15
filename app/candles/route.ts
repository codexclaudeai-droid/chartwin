import {
  MarketCandleRequestError,
  canonicalizeMarketCandleSymbol,
  normalizeMarketCandleMarket,
  normalizeMarketCandleTimeframe,
  selectMarketCandles,
} from '../../src/server/chart-service/market-candles.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = normalizeMarketCandleMarket(url.searchParams.get('market'));
  const symbol = canonicalizeMarketCandleSymbol(market, url.searchParams.get('symbol'));
  const timeframe = normalizeMarketCandleTimeframe(url.searchParams.get('timeframe') || '1m');
  const limit = Math.max(1, Math.min(3000, Math.floor(Number(url.searchParams.get('limit')) || 300)));

  try {
    const candles = await selectMarketCandles({ market: market ?? '', symbol, timeframe, limit });
    return Response.json({
      ok: true,
      market,
      symbol,
      timeframe,
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
  const message = error instanceof Error ? error.message : 'market candle query failed';
  return Response.json({ ok: false, message: 'market candle query failed', detail: message }, { status: 500 });
}
