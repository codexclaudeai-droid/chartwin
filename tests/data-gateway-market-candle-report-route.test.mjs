import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('data gateway exposes a common postgres-backed candle route for strategy reports', () => {
  const source = fs.readFileSync(new URL('../server/data-gateway.mjs', import.meta.url), 'utf8');

  assert.match(source, /function handleGetReportCandles\(req, res, url\)/);
  assert.match(source, /marketCandlePostgresStore\.selectCandles/);
  assert.match(source, /url\.pathname === '\/report\/candles'/);
  assert.match(source, /'GET \/report\/candles\?market=crypto&symbol=BTCUSDT&timeframe=1m&limit=5000'/);
});
