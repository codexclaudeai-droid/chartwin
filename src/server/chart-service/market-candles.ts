import {
  createNodePgPostgresQueryExecutor,
  type ClosablePostgresQueryExecutor,
} from './postgres-node-pg.ts';
import type { PostgresRow, PostgresStatement } from './postgres-mappers.ts';
import {
  getChartServiceRepositoryConfigFromEnv,
  resolveChartServiceRepositoryAdapter,
  type ChartServiceRepositoryAdapterConfig,
} from './repository-adapter.ts';

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketCandleQuery = {
  market: string;
  symbol: string;
  timeframe: string;
  fromSec?: string | number | null;
  toSec?: string | number | null;
  limit?: string | number | null;
};

const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'] as const;

export function normalizeMarketCandleMarket(input: unknown): string | null {
  const market = String(input ?? '').trim().toLowerCase();
  return (ALLOWED_MARKETS as readonly string[]).includes(market) ? market : null;
}

export function normalizeMarketCandleTimeframe(input: unknown): string {
  return String(input ?? '').trim();
}

export function normalizeMarketCandleSymbol(input: unknown): string {
  return String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function canonicalizeMarketCandleSymbol(market: string | null, symbol: unknown): string {
  const normalized = normalizeMarketCandleSymbol(symbol);
  if (market === 'index' && (normalized === 'NAS100' || normalized === 'NQ')) return 'NQ1!';
  if (market === 'index' && normalized === '^IXIC') return 'NASDAQ';
  return normalized;
}

export function createMarketCandleSelectStatement(query: MarketCandleQuery): PostgresStatement {
  const market = normalizeMarketCandleMarket(query.market) ?? '';
  const symbol = canonicalizeMarketCandleSymbol(market, query.symbol);
  const timeframe = normalizeMarketCandleTimeframe(query.timeframe);
  const values: unknown[] = [market, symbol, timeframe];
  const where = ['market = $1', 'symbol = $2', 'timeframe = $3'];

  const fromTimeSec = parseUnixTimeSec(query.fromSec);
  if (Number.isFinite(fromTimeSec)) {
    values.push(new Date(fromTimeSec * 1000).toISOString());
    where.push(`time >= $${values.length}::timestamptz`);
  }

  const toTimeSec = parseUnixTimeSec(query.toSec);
  if (Number.isFinite(toTimeSec)) {
    values.push(new Date(toTimeSec * 1000).toISOString());
    where.push(`time <= $${values.length}::timestamptz`);
  }

  values.push(Math.max(1, Math.min(100000, Math.floor(Number(query.limit) || 5000))));

  return {
    sql: [
      'select extract(epoch from time)::bigint as time,',
      'open, high, low, close, volume',
      'from (',
      'select time, open::float8 as open, high::float8 as high, low::float8 as low,',
      'close::float8 as close, volume::float8 as volume',
      'from market_candles',
      `where ${where.join(' and ')}`,
      'order by time desc',
      `limit $${values.length}`,
      ') latest_market_candles',
      'order by time asc',
    ].join(' '),
    values,
  };
}

export function mapMarketCandleRows(rows: PostgresRow[]): MarketCandle[] {
  return rows
    .map((row) => {
      const time = Number(row.time);
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const close = Number(row.close);
      const volume = row.volume == null ? 0 : Number(row.volume);
      if (![time, open, high, low, close, volume].every(Number.isFinite)) return null;
      return {
        time: Math.floor(time),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((row): row is MarketCandle => row != null);
}

export async function selectMarketCandles(query: MarketCandleQuery): Promise<MarketCandle[]> {
  const market = normalizeMarketCandleMarket(query.market);
  const symbol = canonicalizeMarketCandleSymbol(market, query.symbol);
  const timeframe = normalizeMarketCandleTimeframe(query.timeframe);
  if (!market || !symbol || !timeframe) {
    throw new MarketCandleRequestError('market/symbol/timeframe query is required', 400);
  }

  const executor = createMarketCandleQueryExecutorFromConfig(getChartServiceRepositoryConfigFromEnv());
  if (!executor) {
    throw new MarketCandleRequestError('postgres market candle store is not configured', 503);
  }

  try {
    const result = await executor.query(createMarketCandleSelectStatement({
      ...query,
      market,
      symbol,
      timeframe,
    }));
    return mapMarketCandleRows(result.rows);
  } finally {
    await executor.close();
  }
}

export class MarketCandleRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MarketCandleRequestError';
    this.status = status;
  }
}

function createMarketCandleQueryExecutorFromConfig(
  config: ChartServiceRepositoryAdapterConfig,
): ClosablePostgresQueryExecutor | null {
  const adapter = resolveChartServiceRepositoryAdapter(config);
  if (adapter.kind !== 'postgres' || !adapter.connection) return null;
  return createNodePgPostgresQueryExecutor(adapter.connection);
}

function parseUnixTimeSec(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string') {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    const parsedMs = Date.parse(value);
    if (Number.isFinite(parsedMs)) return Math.floor(parsedMs / 1000);
  }
  return NaN;
}
