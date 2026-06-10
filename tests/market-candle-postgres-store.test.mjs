import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMarketCandleSelectStatement,
  createMarketCandleUpsertStatement,
  normalizeMarketCandle,
} from '../server/market-candle-postgres-store.mjs';

test('market candle store normalizes unix seconds into postgres candle rows', () => {
  const row = normalizeMarketCandle('crypto', 'btcusdt', '1m', {
    time: 1713916800,
    open: '64000.1',
    high: 64010.2,
    low: 63990.3,
    close: 64005.4,
    volume: 12.345,
  });

  assert.deepEqual(row, {
    market: 'crypto',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    time: '2024-04-24T00:00:00.000Z',
    open: 64000.1,
    high: 64010.2,
    low: 63990.3,
    close: 64005.4,
    volume: 12.345,
  });
});

test('market candle store builds an idempotent batched upsert statement', () => {
  const statement = createMarketCandleUpsertStatement('crypto', 'BTCUSDT', '1m', [
    { time: 1713916800, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    { time: 1713916860, open: 2, high: 3, low: 1, close: 2.5, volume: 20 },
  ]);

  assert.match(statement.sql, /insert into market_candles/i);
  assert.match(statement.sql, /on conflict \(market, symbol, timeframe, time\) do update/i);
  assert.match(statement.sql, /updated_at = now\(\)/i);
  assert.equal(statement.values.length, 18);
  assert.deepEqual(statement.values.slice(0, 9), [
    'crypto',
    'BTCUSDT',
    '1m',
    '2024-04-24T00:00:00.000Z',
    1,
    2,
    0.5,
    1.5,
    10,
  ]);
});

test('market candle store builds bounded range queries for any symbol', () => {
  const statement = createMarketCandleSelectStatement({
    market: 'crypto',
    symbol: 'ETHUSDT',
    timeframe: '5m',
    fromSec: 1713916800,
    toSec: 1714000000,
    limit: 5000,
  });

  assert.match(statement.sql, /select market, symbol, timeframe, extract\(epoch from time\)::bigint as time/i);
  assert.match(statement.sql, /from market_candles/i);
  assert.match(statement.sql, /where market = \$1 and symbol = \$2 and timeframe = \$3/i);
  assert.match(statement.sql, /time >= \$4::timestamptz/i);
  assert.match(statement.sql, /time <= \$5::timestamptz/i);
  assert.match(statement.sql, /order by time asc/i);
  assert.match(statement.sql, /limit \$6/i);
  assert.deepEqual(statement.values, [
    'crypto',
    'ETHUSDT',
    '5m',
    '2024-04-24T00:00:00.000Z',
    '2024-04-24T23:06:40.000Z',
    5000,
  ]);
});
