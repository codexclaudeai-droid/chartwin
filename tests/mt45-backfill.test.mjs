import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeMt45BackfillCandles } from '../server/mt45-tick-collector.mjs';

test('MT45 backfill normalizer accepts CopyRates OHLCV rows and canonicalizes NAS100 futures', () => {
  const candles = normalizeMt45BackfillCandles({
    market: 'Index Futures',
    symbol: 'NAS100 Futures',
    timeframe: '1m',
    candles: [
      { time: '2026-06-16T13:00:12Z', open: '30400.25', high: '30410.5', low: '30390', close: '30405.75', tick_volume: '42' },
      { time: 1781614860000, open: 30405.75, high: 30420, low: 30400, close: 30418, real_volume: 7 },
    ],
  });

  assert.equal(candles.market, 'futures');
  assert.equal(candles.symbol, 'NQ1!');
  assert.equal(candles.timeframe, '1m');
  assert.deepEqual(candles.candles, [
    { time: 1781614800, open: 30400.25, high: 30410.5, low: 30390, close: 30405.75, volume: 42 },
    { time: 1781614860, open: 30405.75, high: 30420, low: 30400, close: 30418, volume: 7 },
  ]);
});

test('data gateway exposes a dedicated MT45 backfill endpoint using MT45 API key auth', async () => {
  const source = await readFile(new URL('../server/data-gateway.mjs', import.meta.url), 'utf8');

  assert.match(source, /function handleMt45BackfillIngest\(req, res\)/);
  assert.match(source, /normalizeMt45BackfillCandles/);
  assert.match(source, /checkMt45Ingest\(req, body\)/);
  assert.match(source, /upsertCandles\(market, symbol, timeframe, candles\)/);
  assert.match(source, /url\.pathname === '\/ingest\/mt45\/backfill'/);
});

test('MT5 CopyRates backfill script is included with range and batch inputs', async () => {
  const scriptUrl = new URL('../mt5/scripts/TradingCoreBackfill.mq5', import.meta.url);
  await access(scriptUrl);
  const source = await readFile(scriptUrl, 'utf8');

  assert.match(source, /CopyRates\(/);
  assert.match(source, /input datetime FromTime/);
  assert.match(source, /input datetime ToTime/);
  assert.match(source, /input int LookbackDays/);
  assert.match(source, /input int BatchSize/);
  assert.match(source, /\/ingest\/mt45\/backfill/);
  assert.match(source, /WebRequest\("POST"/);
});
