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
import { TIMEFRAME_SECONDS } from '../../catalog/time.ts';
import { sanitizeGatewayCandles } from '../../data/gateway-candle-sanitize.ts';

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

export type MarketCandleUpsertInput = {
  market: string;
  symbol: string;
  timeframe: string;
  candles: unknown[];
};

const ALLOWED_MARKETS = ['crypto', 'futures', 'index', 'commodity', 'fx'] as const;
const MARKET_CANDLE_COLUMNS = [
  'market',
  'symbol',
  'timeframe',
  'time',
  'open',
  'high',
  'low',
  'close',
  'volume',
] as const;

export function normalizeMarketCandleMarket(input: unknown): string | null {
  const raw = String(input ?? '').trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  const market = compact === 'indexfutures'
    || compact === 'nasdaqfutures'
    || compact === 'nas100futures'
    ? 'futures'
    : raw;
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
  if (
    (market === 'index' || market === 'futures')
    && (
      normalized === 'NQ1!'
      || normalized === 'NAS100'
      || normalized === 'NQ'
      || normalized === 'NAS100FT'
      || normalized === 'NAS100.FT'
      || normalized === 'NAS100FUTURES'
    )
  ) return 'NQ1!';
  if (market === 'index' && normalized === '^IXIC') return 'NASDAQ';
  return normalized;
}

export function canonicalizeMarketCandleMarket(market: string | null, symbol: unknown): string | null {
  const normalized = normalizeMarketCandleSymbol(symbol);
  if (
    normalized === 'NQ1!'
    || normalized === 'NAS100'
    || normalized === 'NQ'
    || normalized === 'NAS100FT'
    || normalized === 'NAS100.FT'
    || normalized === 'NAS100FUTURES'
  ) return 'futures';
  return market;
}

export function createMarketCandleSelectStatement(query: MarketCandleQuery): PostgresStatement {
  const requestedMarket = normalizeMarketCandleMarket(query.market);
  const market = canonicalizeMarketCandleMarket(requestedMarket, query.symbol) ?? '';
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

export function getMarketCandleSchemaStatements(): PostgresStatement[] {
  return [
    {
      sql: [
        'create table if not exists market_candles (',
        'market text not null,',
        'symbol text not null,',
        'timeframe text not null,',
        'time timestamptz not null,',
        'open numeric not null,',
        'high numeric not null,',
        'low numeric not null,',
        'close numeric not null,',
        'volume numeric default 0,',
        'created_at timestamptz default now(),',
        'updated_at timestamptz default now(),',
        'primary key (market, symbol, timeframe, time)',
        ')',
      ].join(' '),
      values: [],
    },
    {
      sql: 'create index if not exists idx_market_candles_symbol_time on market_candles (market, symbol, time)',
      values: [],
    },
    {
      sql: 'create index if not exists idx_market_candles_timeframe_time on market_candles (market, symbol, timeframe, time)',
      values: [],
    },
  ];
}

export function normalizeMarketCandleInput(candle: unknown): MarketCandle | null {
  if (!candle || typeof candle !== 'object') return null;
  const row = candle as Record<string, unknown>;
  const time = parseUnixTimeSec(row.time);
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = row.volume == null ? 0 : Number(row.volume);
  if (![time, open, high, low, close, volume].every(Number.isFinite)) return null;
  return {
    time,
    open,
    high,
    low,
    close,
    volume,
  };
}

export function createMarketCandleUpsertStatement(input: MarketCandleUpsertInput): PostgresStatement | null {
  const requestedMarket = normalizeMarketCandleMarket(input.market);
  const market = canonicalizeMarketCandleMarket(requestedMarket, input.symbol) ?? '';
  const symbol = canonicalizeMarketCandleSymbol(market, input.symbol);
  const timeframe = normalizeMarketCandleTimeframe(input.timeframe);
  const rows = (Array.isArray(input.candles) ? input.candles : [])
    .map(normalizeMarketCandleInput)
    .filter((row): row is MarketCandle => row != null);
  if (!market || !symbol || !timeframe || !rows.length) return null;

  const values: unknown[] = [];
  const rowSql = rows.map((row) => {
    const normalized = {
      market,
      symbol,
      timeframe,
      time: new Date(row.time * 1000).toISOString(),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    };
    const placeholders = MARKET_CANDLE_COLUMNS.map((column) => {
      values.push(normalized[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  return {
    sql: [
      `insert into market_candles (${MARKET_CANDLE_COLUMNS.join(', ')})`,
      `values ${rowSql.join(', ')}`,
      'on conflict (market, symbol, timeframe, time) do update set',
      'open = excluded.open,',
      'high = excluded.high,',
      'low = excluded.low,',
      'close = excluded.close,',
      'volume = excluded.volume,',
      'updated_at = now()',
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

export function sanitizeMarketCandles(candles: MarketCandle[]): MarketCandle[] {
  return sanitizeGatewayCandles(candles);
}

export function aggregateMarketCandlesToTimeframe(
  candles: MarketCandle[],
  timeframe: string,
): MarketCandle[] {
  const targetSec = getMarketCandleTimeframeSec(timeframe);
  if (!Array.isArray(candles) || !Number.isFinite(targetSec) || targetSec <= 60 || targetSec % 60 !== 0) {
    return Array.isArray(candles) ? candles : [];
  }

  const buckets = new Map<number, MarketCandle>();
  candles
    .slice()
    .sort((a, b) => a.time - b.time)
    .forEach((candle) => {
      const bucketTime = Math.floor(candle.time / targetSec) * targetSec;
      const existing = buckets.get(bucketTime);
      if (!existing) {
        buckets.set(bucketTime, { ...candle, time: bucketTime });
        return;
      }
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
      existing.volume += candle.volume;
    });

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export async function selectMarketCandles(query: MarketCandleQuery): Promise<MarketCandle[]> {
  const requestedMarket = normalizeMarketCandleMarket(query.market);
  const market = canonicalizeMarketCandleMarket(requestedMarket, query.symbol);
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
    await ensureMarketCandleSchema(executor);
    const result = await executor.query(createMarketCandleSelectStatement({
      ...query,
      market,
      symbol,
      timeframe,
    }));
    const candles = sanitizeMarketCandles(mapMarketCandleRows(result.rows));
    if (candles.length || timeframe === '1m' || !canAggregateMarketCandleFallback(timeframe)) {
      return candles;
    }

    const targetLimit = Math.max(1, Math.min(100000, Math.floor(Number(query.limit) || 5000)));
    const sourceMultiplier = Math.max(1, Math.ceil(getMarketCandleTimeframeSec(timeframe) / 60));
    const fallbackResult = await executor.query(createMarketCandleSelectStatement({
      ...query,
      market,
      symbol,
      timeframe: '1m',
      limit: Math.min(100000, targetLimit * sourceMultiplier),
    }));
    return aggregateMarketCandlesToTimeframe(
      sanitizeMarketCandles(mapMarketCandleRows(fallbackResult.rows)),
      timeframe,
    ).slice(-targetLimit);
  } finally {
    await executor.close();
  }
}

export async function upsertMarketCandles(input: MarketCandleUpsertInput): Promise<number> {
  const requestedMarket = normalizeMarketCandleMarket(input.market);
  const market = canonicalizeMarketCandleMarket(requestedMarket, input.symbol);
  const symbol = canonicalizeMarketCandleSymbol(market, input.symbol);
  const timeframe = normalizeMarketCandleTimeframe(input.timeframe);
  const statement = createMarketCandleUpsertStatement({
    ...input,
    market: market ?? '',
    symbol,
    timeframe,
  });
  if (!market || !symbol || !timeframe || !statement) {
    throw new MarketCandleRequestError('market/symbol/timeframe/candles is required', 400);
  }

  const executor = createMarketCandleQueryExecutorFromConfig(getChartServiceRepositoryConfigFromEnv());
  if (!executor) {
    throw new MarketCandleRequestError('postgres market candle store is not configured', 503);
  }

  try {
    await ensureMarketCandleSchema(executor);
    await executor.query(statement);
    return statement.values.length / MARKET_CANDLE_COLUMNS.length;
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

async function ensureMarketCandleSchema(executor: ClosablePostgresQueryExecutor): Promise<void> {
  for (const statement of getMarketCandleSchemaStatements()) {
    await executor.query(statement);
  }
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

function getMarketCandleTimeframeSec(timeframe: string): number {
  return (TIMEFRAME_SECONDS as Record<string, number | undefined>)[timeframe] ?? NaN;
}

function canAggregateMarketCandleFallback(timeframe: string): boolean {
  const targetSec = getMarketCandleTimeframeSec(timeframe);
  return Number.isFinite(targetSec) && targetSec > 60 && targetSec % 60 === 0;
}
