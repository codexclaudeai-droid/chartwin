import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createMarketCandleServerProvider } from '../src/server/chart-service/index.ts';

test('gateway server candle provider forwards the scheduled Worker runtime environment', async () => {
  const runtimeEnv = {
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_RUNTIME_TARGET: 'cloudflare-workers',
    HYPERDRIVE: { connectionString: 'postgresql://hyperdrive.test/postgres' },
  };
  let receivedEnv = null;
  let receivedQuery = null;
  const provider = createMarketCandleServerProvider(async (query, env) => {
    receivedEnv = env;
    receivedQuery = query;
    return [
      { time: 60, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 120, open: 11, high: 13, low: 10, close: 12, volume: 2 },
    ];
  }, runtimeEnv);

  const candles = await provider({ symbol: 'NQ1!', timeframe: '1m', limit: 3000 });

  assert.equal(receivedEnv, runtimeEnv);
  assert.deepEqual(receivedQuery, {
    market: 'futures',
    symbol: 'NQ1!',
    timeframe: '1m',
    limit: 3000,
  });
  assert.equal(candles.length, 2);
  assert.equal(candles.at(-1)?.close, 12);
});

test('Cloudflare scheduled monitor builds its candle provider with the Worker environment', () => {
  const scheduledSource = fs.readFileSync(
    new URL('../src/server/chart-service/cloudflare-scheduled.ts', import.meta.url),
    'utf8',
  );
  const marketCandleSource = fs.readFileSync(
    new URL('../src/server/chart-service/market-candles.ts', import.meta.url),
    'utf8',
  );

  assert.match(scheduledSource, /createHybridServerCandleProvider\(fetch, env\)/);
  assert.match(scheduledSource, /candleProvider/);
  assert.match(marketCandleSource, /getChartServiceRepositoryConfigFromEnv\(runtimeEnv\)/);
});
