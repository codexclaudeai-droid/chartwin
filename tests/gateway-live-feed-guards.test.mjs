import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeGatewayCandles } from '../src/data/gateway-candle-sanitize.ts';
import { normalizeSignalSeriesLength } from '../src/strategy/signal-series.ts';
import { sanitizeCandleSeries, shouldResetCandleSeries } from '../server/candle-series-guards.mjs';

const initSource = fs.readFileSync(path.resolve('src/app/init.ts'), 'utf8');
const strategyReportPanelSource = fs.readFileSync(path.resolve('src/ui/workspace/strategy-report-panel.ts'), 'utf8');
const gatewayServerSource = fs.readFileSync(path.resolve('server/data-gateway.mjs'), 'utf8');
const pagesCandlesSource = fs.readFileSync(path.resolve('functions/candles.js'), 'utf8');
const pagesWebhookSource = fs.readFileSync(path.resolve('functions/ingest/webhook/tradingview.js'), 'utf8');

test('sanitizeGatewayCandles drops implausible outlier candles but keeps surrounding valid rows', () => {
  const rows = sanitizeGatewayCandles([
    { time: 1, open: 27272, high: 27279.5, low: 27268.87, close: 27272, volume: 3431 },
    { time: 2, open: 11, high: 12, low: 10, close: 11.5, volume: 1 },
    { time: 3, open: 27273, high: 27280, low: 27270, close: 27275, volume: 1200 },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.time), [1, 3]);
  assert.deepEqual(rows.map((row) => row.close), [27272, 27275]);
});

test('normalizeSignalSeriesLength pads missing worker signals with zeros to match candle count', () => {
  assert.deepEqual(normalizeSignalSeriesLength([1, 0, -1], 5), [1, 0, -1, 0, 0]);
  assert.deepEqual(normalizeSignalSeriesLength([1, 0, -1, 1], 2), [1, 0]);
  assert.deepEqual(normalizeSignalSeriesLength([], 3), [0, 0, 0]);
});

test('sanitizeCandleSeries keeps only the latest contiguous segment and drops implausible jumps', () => {
  const rows = sanitizeCandleSeries([
    { time: 60, open: 27000, high: 27010, low: 26990, close: 27005, volume: 10 },
    { time: 120, open: 27005, high: 27015, low: 27000, close: 27010, volume: 10 },
    { time: 60 * 60 * 24 * 30, open: 30520, high: 30530, low: 30510, close: 30525, volume: 10 },
    { time: 60 * 60 * 24 * 30 + 60, open: 11, high: 12, low: 10, close: 11.5, volume: 1 },
    { time: 60 * 60 * 24 * 30 + 120, open: 30525, high: 30535, low: 30515, close: 30528, volume: 11 },
  ], { timeframeSec: 60, maxGapBars: 1000 });

  assert.deepEqual(rows.map((row) => row.time), [60 * 60 * 24 * 30, 60 * 60 * 24 * 30 + 120]);
  assert.deepEqual(rows.map((row) => row.close), [30525, 30528]);
});

test('shouldResetCandleSeries detects when fresh intraday rows should replace stale history', () => {
  assert.equal(
    shouldResetCandleSeries(
      [{ time: 1715940000, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
      [{ time: 1718540000, open: 2, high: 2, low: 2, close: 2, volume: 1 }],
      { timeframeSec: 60, maxGapBars: 3000 },
    ),
    true,
  );
});

test('signal length normalization is used for live signal notifications and strategy reports', () => {
  assert.match(
    initSource,
    /normalizeSignalSeriesLength\(pane\.chart\.getStrategySignalSeries\(\), candles\.length\)/,
    'notification counts should align worker signals to the current candle window',
  );
  assert.match(
    strategyReportPanelSource,
    /normalizeSignalSeriesLength\(chart\.getStrategySignalSeries\(\), candles\.length\)/,
    'strategy report refresh should align worker signals to candle length before slicing',
  );
});

test('gateway read/write paths use candle guards for stale history and corrupt rows', () => {
  assert.match(gatewayServerSource, /sanitizeCandleSeries\(parsed, \{/);
  assert.match(gatewayServerSource, /shouldResetCandleSeries\(current, sanitizedIncoming, \{/);
  assert.match(pagesCandlesSource, /sanitizeCandleSeries\(result1m\.rows, \{/);
  assert.match(pagesWebhookSource, /shouldResetCandleSeries\(existing, candles, \{/);
});
