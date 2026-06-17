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
];

function normalizeMarket(input) {
  const raw = String(input || '').trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  if (compact === 'indexfutures' || compact === 'nasdaqfutures' || compact === 'nas100futures') return 'futures';
  return raw;
}

function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeTimeframe(input) {
  return String(input || '').trim();
}

function parseUnixTimeSec(value) {
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

export function normalizeMarketCandle(market, symbol, timeframe, candle) {
  if (!candle || typeof candle !== 'object') return null;
  const timeSec = parseUnixTimeSec(candle.time);
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const volume = Number(candle.volume);
  if (![timeSec, open, high, low, close].every(Number.isFinite)) return null;
  return {
    market: normalizeMarket(market),
    symbol: normalizeSymbol(symbol),
    timeframe: normalizeTimeframe(timeframe),
    time: new Date(timeSec * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

export function createMarketCandleUpsertStatement(market, symbol, timeframe, candles) {
  const rows = (Array.isArray(candles) ? candles : [])
    .map((candle) => normalizeMarketCandle(market, symbol, timeframe, candle))
    .filter((row) => row != null);
  if (!rows.length) return null;

  const values = [];
  const rowSql = rows.map((row) => {
    const placeholders = MARKET_CANDLE_COLUMNS.map((column) => {
      values.push(row[column]);
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

export function createMarketCandleSelectStatement({
  market,
  symbol,
  timeframe,
  fromSec = null,
  toSec = null,
  limit = 5000,
}) {
  const values = [normalizeMarket(market), normalizeSymbol(symbol), normalizeTimeframe(timeframe)];
  const where = ['market = $1', 'symbol = $2', 'timeframe = $3'];
  const fromTimeSec = parseUnixTimeSec(fromSec);
  if (Number.isFinite(fromTimeSec)) {
    values.push(new Date(fromTimeSec * 1000).toISOString());
    where.push(`time >= $${values.length}::timestamptz`);
  }
  const toTimeSec = parseUnixTimeSec(toSec);
  if (Number.isFinite(toTimeSec)) {
    values.push(new Date(toTimeSec * 1000).toISOString());
    where.push(`time <= $${values.length}::timestamptz`);
  }
  values.push(Math.max(1, Math.min(100000, Math.floor(Number(limit) || 5000))));

  return {
    sql: [
      'select market, symbol, timeframe, extract(epoch from time)::bigint as time,',
      'open::float8 as open, high::float8 as high, low::float8 as low,',
      'close::float8 as close, volume::float8 as volume',
      'from market_candles',
      `where ${where.join(' and ')}`,
      'order by time asc',
      `limit $${values.length}`,
    ].join(' '),
    values,
  };
}

export function createMarketCandlePostgresStore(executor, logger = console) {
  return {
    async upsertCandles(market, symbol, timeframe, candles) {
      const statement = createMarketCandleUpsertStatement(market, symbol, timeframe, candles);
      if (!statement) return 0;
      await executor.query(statement);
      return statement.values.length / MARKET_CANDLE_COLUMNS.length;
    },
    async tryUpsertCandles(market, symbol, timeframe, candles) {
      try {
        return await this.upsertCandles(market, symbol, timeframe, candles);
      } catch (error) {
        logger.warn?.(`[market-candles] postgres upsert failed: ${error.message}`);
        return 0;
      }
    },
    async selectCandles(query) {
      const statement = createMarketCandleSelectStatement(query);
      const result = await executor.query(statement);
      return result.rows.map((row) => ({
        time: Number(row.time),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      })).filter((row) => (
        [row.time, row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite)
      ));
    },
  };
}

export async function createMarketCandlePostgresStoreFromEnv(env = process.env, logger = console) {
  const repository = String(env.CHART_SERVICE_REPOSITORY || '').trim().toLowerCase();
  const databaseUrl = String(env.CHART_SERVICE_DATABASE_URL || '').trim();
  if (repository !== 'postgres' || !databaseUrl) return null;

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolvePgSslOption(env),
  });
  return createMarketCandlePostgresStore({
    async query(statement) {
      const result = await pool.query(statement.sql, statement.values);
      return { rows: result.rows };
    },
  }, logger);
}

function resolvePgSslOption(env) {
  const raw = String(env.CHART_SERVICE_DATABASE_SSL_MODE || '').trim().toLowerCase();
  if (raw === 'disable') return false;
  if (raw === 'verify-ca' || raw === 'verify-full') return { rejectUnauthorized: true };
  if (raw === 'require') return { rejectUnauthorized: false };
  return undefined;
}
