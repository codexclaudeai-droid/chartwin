import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('gateway live feed exposes postgres-backed report candle fetching', () => {
  const source = fs.readFileSync(new URL('../src/data/gateway-live-feed.ts', import.meta.url), 'utf8');

  assert.match(source, /export async function fetchGatewayReportCandles/);
  assert.match(source, /\/report\/candles\?/);
  assert.match(source, /Math\.min\(100000, limit\)/);
  assert.match(source, /inferGatewayReportMarket/);
});

test('strategy report panel can refresh from stored candles without replacing chart render data', () => {
  const source = fs.readFileSync(new URL('../src/ui/workspace/strategy-report-panel.ts', import.meta.url), 'utf8');

  assert.match(source, /fetchGatewayReportCandles/);
  assert.match(source, /buildStrategyReportFromCandles/);
  assert.match(source, /refreshFromStoredCandles/);
  assert.match(source, /storedCandles\.length > candles\.length/);
});

test('SimpleChart builds strategy reports against temporary candle history and restores chart state', () => {
  const source = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

  assert.match(source, /public buildStrategyReportFromCandles/);
  assert.match(source, /computeStrategySignalsForCandles/);
  assert.match(source, /const previousData = this\.data/);
  assert.match(source, /finally\s*{\s*this\.data = previousData;/);
});
