import type { TimeframeKey } from '../../catalog/time.ts';
import {
  inferGatewayReportMarket,
  normalizeSymbol,
  shouldUseBinanceDirect,
} from '../../data/gateway-market.ts';
import type { ServerStrategyCandle } from './server-strategy-signals.ts';
import { selectMarketCandles } from './market-candles.ts';

export type ServerCandleProvider = (args: {
  symbol: string;
  timeframe: TimeframeKey;
  limit: number;
}) => Promise<ServerStrategyCandle[]>;

type BinanceMarket = 'spot' | 'futures';

const BINANCE_INTERVAL_BY_TIMEFRAME: Partial<Record<TimeframeKey, string>> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
};

export function createBinanceServerCandleProvider(
  fetcher: typeof fetch = fetch,
): ServerCandleProvider {
  return async ({ symbol, timeframe, limit }) => {
    const interval = BINANCE_INTERVAL_BY_TIMEFRAME[timeframe];
    if (!interval) {
      throw new Error(`Unsupported server alert timeframe: ${timeframe}`);
    }

    const resolved = resolveBinanceMarketSymbol(symbol);
    if (!resolved) {
      throw new Error(`Unsupported server alert symbol: ${symbol}`);
    }

    return await fetchBinanceKlines({
      market: resolved.market,
      symbol: resolved.symbol,
      interval,
      limit,
      fetcher,
    });
  };
}

export function createHybridServerCandleProvider(
  fetcher: typeof fetch = fetch,
): ServerCandleProvider {
  const binanceProvider = createBinanceServerCandleProvider(fetcher);
  const marketCandleProvider = createMarketCandleServerProvider();

  return async (args) => {
    if (shouldUseBinanceDirect(args.symbol)) {
      return await binanceProvider(args);
    }
    return await marketCandleProvider(args);
  };
}

export function createMarketCandleServerProvider(): ServerCandleProvider {
  return async ({ symbol, timeframe, limit }) => {
    const candles = await selectMarketCandles({
      market: inferGatewayReportMarket(symbol),
      symbol: normalizeSymbol(symbol),
      timeframe,
      limit,
    });
    return candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  };
}

function resolveBinanceMarketSymbol(rawSymbol: string): { market: BinanceMarket; symbol: string } | null {
  const upper = rawSymbol.trim().toUpperCase();
  const withoutSuffix = upper.endsWith('.P') ? upper.slice(0, -2) : upper;
  const symbol = withoutSuffix.replace(/[^A-Z0-9]/g, '');
  if (!symbol.endsWith('USDT') && !symbol.endsWith('BUSD') && !symbol.endsWith('USDC')) return null;
  return {
    market: upper.endsWith('.P') ? 'futures' : 'spot',
    symbol,
  };
}

async function fetchBinanceKlines(args: {
  market: BinanceMarket;
  symbol: string;
  interval: string;
  limit: number;
  fetcher: typeof fetch;
}): Promise<ServerStrategyCandle[]> {
  const query = new URLSearchParams({
    symbol: args.symbol,
    interval: args.interval,
    limit: String(Math.max(2, Math.min(1000, Math.floor(args.limit)))),
  });
  const endpoint = args.market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/klines?${query.toString()}`
    : `https://api.binance.com/api/v3/klines?${query.toString()}`;
  const response = await args.fetcher(endpoint, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Binance REST error: ${response.status}`);
  }

  const rows = await response.json() as unknown[];
  return rows
    .map(parseKlineRow)
    .filter((candle): candle is ServerStrategyCandle => candle != null)
    .sort((left, right) => left.time - right.time);
}

function parseKlineRow(row: unknown): ServerStrategyCandle | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTimeMs = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5]);
  if (![openTimeMs, open, high, low, close, volume].every((value) => Number.isFinite(value))) return null;
  return {
    time: Math.floor(openTimeMs / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}
