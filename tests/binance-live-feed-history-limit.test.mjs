import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('binance direct chart feed allows roughly 30 days of 1m history without changing gateway limits', () => {
  const feedSource = fs.readFileSync(new URL('../src/data/binance-live-feed.ts', import.meta.url), 'utf8');
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  const gatewaySource = fs.readFileSync(new URL('../src/data/gateway-live-feed.ts', import.meta.url), 'utf8');

  assert.match(feedSource, /BINANCE_DIRECT_CHART_HISTORY_LIMIT\s*=\s*43_200/);
  assert.match(feedSource, /Math\.min\(BINANCE_DIRECT_CHART_HISTORY_LIMIT,\s*totalLimit\)/);
  assert.match(initSource, /BINANCE_DIRECT_CHART_HISTORY_LIMIT/);
  assert.match(initSource, /limit:\s*BINANCE_DIRECT_CHART_HISTORY_LIMIT/);
  assert.match(gatewaySource, /Math\.min\(3000,\s*limit\)/);
});
