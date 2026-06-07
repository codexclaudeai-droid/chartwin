import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('binance direct chart feed starts with 3000 candles and lazy-loads older history in 1000 candle batches', () => {
  const feedSource = fs.readFileSync(new URL('../src/data/binance-live-feed.ts', import.meta.url), 'utf8');
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  const gatewaySource = fs.readFileSync(new URL('../src/data/gateway-live-feed.ts', import.meta.url), 'utf8');

  assert.match(feedSource, /BINANCE_DIRECT_INITIAL_HISTORY_LIMIT\s*=\s*3000/);
  assert.match(feedSource, /BINANCE_DIRECT_OLDER_HISTORY_BATCH\s*=\s*1000/);
  assert.match(feedSource, /loadOlder:\s*\(\)\s*=>\s*Promise<boolean>/);
  assert.match(feedSource, /fetchBinanceKlinesOlder\(/);
  assert.match(initSource, /BINANCE_DIRECT_INITIAL_HISTORY_LIMIT/);
  assert.match(initSource, /limit:\s*BINANCE_DIRECT_INITIAL_HISTORY_LIMIT/);
  assert.match(initSource, /binanceFeed\.loadOlder\(\)/);
  assert.match(initSource, /const addedCandles = Math\.max\(0, rawCandles\.length - beforeLength\)/);
  assert.match(initSource, /chart\.panViewport\(-addedCandles\)/);
  assert.match(initSource, /monitorOlderHistory/);
  assert.match(gatewaySource, /Math\.min\(3000,\s*limit\)/);
});
