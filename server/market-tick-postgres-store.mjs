const MARKET_TICK_COLUMNS = [
  'market',
  'symbol',
  'time',
  'price',
  'quantity',
  'side',
  'bid',
  'ask',
  'source',
  'account_id',
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

function parseUnixTimeSec(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    const parsedMs = Date.parse(raw);
    if (Number.isFinite(parsedMs)) return Math.floor(parsedMs / 1000);
  }
  return NaN;
}

function optionalFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSide(input) {
  const raw = String(input || '').trim().toLowerCase();
  return raw === 'buy' || raw === 'sell' ? raw : 'unknown';
}

export function normalizeMarketTick(tick) {
  if (!tick || typeof tick !== 'object') return null;
  const timeSec = parseUnixTimeSec(tick.time);
  const price = Number(tick.price);
  const quantity = Number(tick.quantity ?? tick.qty ?? tick.volume);
  if (!Number.isFinite(timeSec) || !Number.isFinite(price)) return null;

  return {
    market: normalizeMarket(tick.market),
    symbol: normalizeSymbol(tick.symbol),
    time: new Date(timeSec * 1000).toISOString(),
    price,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    side: normalizeSide(tick.side),
    bid: optionalFinite(tick.bid),
    ask: optionalFinite(tick.ask),
    source: String(tick.source || 'mt45'),
    account_id: tick.account_id ?? tick.accountId ?? null,
  };
}

export function createMarketTickSchemaStatements() {
  return [
    [
      'create table if not exists market_ticks_raw (',
      'id bigserial primary key,',
      'market text not null,',
      'symbol text not null,',
      'time timestamptz not null,',
      'price double precision not null,',
      'quantity double precision not null default 0,',
      "side text not null default 'unknown' check (side in ('buy', 'sell', 'unknown')),",
      'bid double precision,',
      'ask double precision,',
      "source text not null default 'mt45',",
      'account_id text,',
      'created_at timestamptz not null default now()',
      ')',
    ].join(' '),
    'create index if not exists idx_market_ticks_raw_symbol_time on market_ticks_raw (market, symbol, time desc)',
    'create index if not exists idx_market_ticks_raw_created_at on market_ticks_raw (created_at)',
  ];
}

export function createMarketTickInsertStatement(ticks) {
  const rows = (Array.isArray(ticks) ? ticks : [])
    .map((tick) => normalizeMarketTick(tick))
    .filter((row) => row != null);
  if (!rows.length) return null;

  const values = [];
  const rowSql = rows.map((row) => {
    const placeholders = MARKET_TICK_COLUMNS.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  return {
    sql: [
      `insert into market_ticks_raw (${MARKET_TICK_COLUMNS.join(', ')})`,
      `values ${rowSql.join(', ')}`,
    ].join(' '),
    values,
  };
}

export function createMarketTickPurgeStatement(retentionDays) {
  const days = Math.max(1, Math.min(365, Math.floor(Number(retentionDays) || 7)));
  return {
    sql: "delete from market_ticks_raw where created_at < now() - ($1::int * interval '1 day')",
    values: [days],
  };
}

export function createMarketTickPostgresStore(executor, logger = console) {
  return {
    async ensureSchema() {
      for (const sql of createMarketTickSchemaStatements()) {
        await executor.query({ sql, values: [] });
      }
    },
    async insertTicks(ticks) {
      const statement = createMarketTickInsertStatement(ticks);
      if (!statement) return 0;
      await executor.query(statement);
      return statement.values.length / MARKET_TICK_COLUMNS.length;
    },
    async tryInsertTicks(ticks) {
      try {
        return await this.insertTicks(ticks);
      } catch (error) {
        logger.warn?.(`[market-ticks] postgres insert failed: ${error.message}`);
        return 0;
      }
    },
    async purgeOldTicks(retentionDays) {
      const statement = createMarketTickPurgeStatement(retentionDays);
      const result = await executor.query(statement);
      return Number(result.rowCount || 0);
    },
    async tryPurgeOldTicks(retentionDays) {
      try {
        return await this.purgeOldTicks(retentionDays);
      } catch (error) {
        logger.warn?.(`[market-ticks] postgres purge failed: ${error.message}`);
        return 0;
      }
    },
  };
}

export async function createMarketTickPostgresStoreFromEnv(env = process.env, logger = console) {
  const repository = String(env.CHART_SERVICE_REPOSITORY || '').trim().toLowerCase();
  const databaseUrl = String(env.CHART_SERVICE_DATABASE_URL || '').trim();
  if (repository !== 'postgres' || !databaseUrl) return null;

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolvePgSslOption(env),
  });
  return createMarketTickPostgresStore({
    async query(statement) {
      const result = await pool.query(statement.sql, statement.values);
      return { rows: result.rows, rowCount: result.rowCount };
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
