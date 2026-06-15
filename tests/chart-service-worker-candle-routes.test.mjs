import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('OpenNext Worker exposes gateway candle routes used by the chart feed', () => {
  assert.equal(fs.existsSync('app/candles/route.ts'), true, '/candles route must exist in the Worker app');
  assert.equal(fs.existsSync('app/report/candles/route.ts'), true, '/report/candles route must exist in the Worker app');
  assert.equal(fs.existsSync('app/ingest/webhook/tradingview/route.ts'), true, 'webhook ingest route must exist in the Worker app');

  const candlesRoute = fs.readFileSync('app/candles/route.ts', 'utf8');
  const reportRoute = fs.readFileSync('app/report/candles/route.ts', 'utf8');
  const ingestRoute = fs.readFileSync('app/ingest/webhook/tradingview/route.ts', 'utf8');

  assert.match(candlesRoute, /selectMarketCandles/);
  assert.match(reportRoute, /selectMarketCandles/);
  assert.match(ingestRoute, /upsertMarketCandles/);
});

test('market candle query module keeps gateway-compatible symbol normalization', async () => {
  const {
    canonicalizeMarketCandleSymbol,
    createMarketCandleSelectStatement,
    mapMarketCandleRows,
    normalizeMarketCandleInput,
  } = await import('../src/server/chart-service/market-candles.ts');

  assert.equal(canonicalizeMarketCandleSymbol('index', 'NAS100'), 'NQ1!');
  assert.equal(canonicalizeMarketCandleSymbol('index', '^IXIC'), 'NASDAQ');

  const statement = createMarketCandleSelectStatement({
    market: 'INDEX',
    symbol: 'nas100',
    timeframe: '1m',
    fromSec: 1713916800,
    toSec: 1713916860,
    limit: 5001,
  });

  assert.match(statement.sql, /from market_candles/i);
  assert.match(statement.sql, /order by time desc/i);
  assert.match(statement.sql, /order by time asc/i);
  assert.deepEqual(statement.values, [
    'index',
    'NQ1!',
    '1m',
    '2024-04-24T00:00:00.000Z',
    '2024-04-24T00:01:00.000Z',
    5001,
  ]);

  assert.deepEqual(mapMarketCandleRows([
    { time: '1713916800', open: '1', high: '2', low: '0.5', close: '1.5', volume: null },
  ]), [
    { time: 1713916800, open: 1, high: 2, low: 0.5, close: 1.5, volume: 0 },
  ]);

  assert.deepEqual(normalizeMarketCandleInput({
    time: '2024-04-24T00:00:00.000Z',
    open: '1',
    high: '2',
    low: '0.5',
    close: '1.5',
  }), {
    time: 1713916800,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 0,
  });
});

test('market candle module creates tables and upserts webhook candles', async () => {
  const {
    createMarketCandleUpsertStatement,
    getMarketCandleSchemaStatements,
  } = await import('../src/server/chart-service/market-candles.ts');

  assert.match(getMarketCandleSchemaStatements().map((statement) => statement.sql).join('\n'), /create table if not exists market_candles/i);

  const statement = createMarketCandleUpsertStatement({
    market: 'index',
    symbol: 'NAS100',
    timeframe: '1m',
    candles: [
      { time: 1713916800, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    ],
  });

  assert.match(statement?.sql ?? '', /insert into market_candles/i);
  assert.match(statement?.sql ?? '', /on conflict \(market, symbol, timeframe, time\) do update/i);
  assert.deepEqual(statement?.values.slice(0, 9), [
    'index',
    'NQ1!',
    '1m',
    '2024-04-24T00:00:00.000Z',
    1,
    2,
    0.5,
    1.5,
    10,
  ]);
});
