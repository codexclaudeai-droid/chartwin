import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const gatewayLiveFeedSource = fs.readFileSync(path.resolve('src/data/gateway-live-feed.ts'), 'utf8');

test('gateway live feed falls back to 1m candles and aggregates when a multi-minute response is empty', () => {
  assert.match(
    gatewayLiveFeedSource,
    /aggregateGatewayCandlesToTimeframe\(/,
    'gateway feed should aggregate 1m fallback rows for unsupported multi-minute timeframes',
  );
  assert.match(
    gatewayLiveFeedSource,
    /timeframe !== '1m'[\s\S]*fetchGatewayCandles\(\s*baseUrl,\s*market,\s*symbol,\s*'1m'/,
    'gateway feed should fetch 1m rows when a higher timeframe response is empty',
  );
});
