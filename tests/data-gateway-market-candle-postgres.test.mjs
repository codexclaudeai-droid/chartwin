import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('data gateway dual-writes stored candles to the market candle postgres store when configured', () => {
  const source = fs.readFileSync(new URL('../server/data-gateway.mjs', import.meta.url), 'utf8');

  assert.match(source, /createMarketCandlePostgresStoreFromEnv/);
  assert.match(source, /let marketCandlePostgresStore = null/);
  assert.match(source, /persistMarketCandlesToPostgres\(market, symbol, timeframe, incomingCandles\)/);
  assert.match(source, /persistMarketCandlesToPostgres\(market, canonicalSymbol, timeframe, \[incoming\]\)/);
});
