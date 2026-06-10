import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('binance direct feed derives live candle delta from aggTrade maker side', () => {
  const source = fs.readFileSync(new URL('../src/data/binance-live-feed.ts', import.meta.url), 'utf8');

  assert.match(source, /const makerValue = payload\.m/);
  assert.match(source, /isBuyerMaker === true[\s\S]*volumeDelta: -qty/);
  assert.match(source, /isBuyerMaker === false[\s\S]*volumeDelta: qty/);
  assert.match(source, /connectTradeWebSocket\(resolved\.market, symbol\)/);
});

test('binance direct feed accumulates live footprint levels from aggTrade maker side', () => {
  const source = fs.readFileSync(new URL('../src/data/binance-live-feed.ts', import.meta.url), 'utf8');

  assert.match(source, /getFootprintTradeSide\(isBuyerMaker\)/);
  assert.match(source, /applyTradeFootprint\(undefined,\s*price,\s*qty,\s*side\)/);
  assert.match(source, /applyTradeFootprint\(last\.footprint,\s*price,\s*qty,\s*side\)/);
  assert.match(source, /footprint: applyTradeFootprint/);
});
