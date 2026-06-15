import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMarketTickInsertStatement,
  createMarketTickPurgeStatement,
  createMarketTickSchemaStatements,
  normalizeMarketTick,
} from '../server/market-tick-postgres-store.mjs';

test('market tick store normalizes raw MT45 ticks for postgres insert', () => {
  const row = normalizeMarketTick({
    market: 'futures',
    symbol: 'nq1!',
    time: 1713916810,
    price: '17750.25',
    quantity: '2.5',
    side: 'BUY',
    bid: '17750',
    ask: '17750.5',
    source: 'mt45',
    accountId: 'terminal-1',
  });

  assert.deepEqual(row, {
    market: 'futures',
    symbol: 'NQ1!',
    time: '2024-04-24T00:00:10.000Z',
    price: 17750.25,
    quantity: 2.5,
    side: 'buy',
    bid: 17750,
    ask: 17750.5,
    source: 'mt45',
    account_id: 'terminal-1',
  });
});

test('market tick store builds batched raw tick insert statement', () => {
  const statement = createMarketTickInsertStatement([
    { market: 'futures', symbol: 'NQ1!', time: 1713916810, price: 100, quantity: 2, side: 'buy', source: 'mt45' },
    { market: 'futures', symbol: 'NQ1!', time: 1713916811, price: 99.75, quantity: 1, side: 'sell', source: 'mt45' },
  ]);

  assert.match(statement.sql, /insert into market_ticks_raw/i);
  assert.match(statement.sql, /market, symbol, time, price, quantity, side, bid, ask, source, account_id/i);
  assert.equal(statement.values.length, 20);
  assert.deepEqual(statement.values.slice(0, 10), [
    'futures',
    'NQ1!',
    '2024-04-24T00:00:10.000Z',
    100,
    2,
    'buy',
    null,
    null,
    'mt45',
    null,
  ]);
});

test('market tick store exposes schema and bounded retention purge statements', () => {
  const schema = createMarketTickSchemaStatements().join('\n');
  assert.match(schema, /create table if not exists market_ticks_raw/i);
  assert.match(schema, /idx_market_ticks_raw_symbol_time/i);
  assert.match(schema, /idx_market_ticks_raw_created_at/i);

  const purge = createMarketTickPurgeStatement(14);
  assert.match(purge.sql, /delete from market_ticks_raw/i);
  assert.match(purge.sql, /created_at < now\(\) - \(\$1::int \* interval '1 day'\)/i);
  assert.deepEqual(purge.values, [14]);
});
