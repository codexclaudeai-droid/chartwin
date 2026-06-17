import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeGatewayCandles } from '../src/data/gateway-candle-sanitize.ts';
import { normalizeSignalSeriesLength } from '../src/strategy/signal-series.ts';
import { sanitizeCandleSeries, shouldResetCandleSeries } from '../server/candle-series-guards.mjs';

const initSource = fs.readFileSync(path.resolve('src/app/init.ts'), 'utf8');
const simpleChartSource = fs.readFileSync(path.resolve('src/chart/SimpleChart.ts'), 'utf8');
const strategyReportPanelSource = fs.readFileSync(path.resolve('src/ui/workspace/strategy-report-panel.ts'), 'utf8');
const gatewayLiveFeedSource = fs.readFileSync(path.resolve('src/data/gateway-live-feed.ts'), 'utf8');
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

test('sanitizeGatewayCandles keeps the latest plausible price cluster for NQ history', () => {
  const rows = sanitizeGatewayCandles([
    { time: 1781550420, open: 17750.25, high: 17752, low: 17749, close: 17750.25, volume: 10 },
    { time: 1781550480, open: 17751, high: 17753, low: 17750, close: 17752, volume: 12 },
    { time: 1781550540, open: 30510, high: 30530, low: 30500, close: 30520, volume: 40 },
    { time: 1781550600, open: 30520, high: 30540, low: 30515, close: 30535, volume: 44 },
  ]);

  assert.deepEqual(rows.map((row) => row.time), [1781550540, 1781550600]);
  assert.deepEqual(rows.map((row) => row.close), [30520, 30535]);
});

test('sanitizeGatewayCandles preserves MT enriched volume and normalizes footprint maps', () => {
  const rows = sanitizeGatewayCandles([
    {
      time: 1781550540,
      open: 4311,
      high: 4312,
      low: 4310,
      close: 4311.5,
      volume: 8,
      buyVolume: 5,
      sellVolume: 3,
      footprint: {
        4311: { buyVolume: 2, sellVolume: 1 },
        4311.5: { buyVolume: 3, sellVolume: 2 },
      },
    },
  ]);

  assert.equal(rows[0].buyVolume, 5);
  assert.equal(rows[0].sellVolume, 3);
  assert.equal(rows[0].volumeDelta, 2);
  assert.deepEqual(rows[0].footprint, [
    { price: 4311, buyVolume: 2, sellVolume: 1, volumeDelta: 1, totalVolume: 3 },
    { price: 4311.5, buyVolume: 3, sellVolume: 2, volumeDelta: 1, totalVolume: 5 },
  ]);
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

test('sanitizeCandleSeries also trims stale low-price NQ clusters before current rows', () => {
  const rows = sanitizeCandleSeries([
    { time: 1781550420, open: 17750.25, high: 17752, low: 17749, close: 17750.25, volume: 10 },
    { time: 1781550480, open: 17751, high: 17753, low: 17750, close: 17752, volume: 12 },
    { time: 1781550540, open: 30510, high: 30530, low: 30500, close: 30520, volume: 40 },
    { time: 1781550600, open: 30520, high: 30540, low: 30515, close: 30535, volume: 44 },
  ], { timeframeSec: 60, maxGapBars: 3000 });

  assert.deepEqual(rows.map((row) => row.time), [1781550540, 1781550600]);
  assert.deepEqual(rows.map((row) => row.close), [30520, 30535]);
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

test('confirmed signal length normalization is used for live signal notifications and strategy reports', () => {
  assert.match(
    initSource,
    /normalizeConfirmedSignalSeriesLength\(\s*pane\.chart\.getStrategySignalSeries\(\),\s*candles,\s*pane\.chart\.config\.timeframe,\s*\)/,
    'notification counts should align worker signals to the current confirmed candle window',
  );
  assert.match(
    strategyReportPanelSource,
    /normalizeConfirmedSignalSeriesLength\(\s*chart\.getStrategySignalSeries\(\),\s*candles,\s*chart\.config\.timeframe,\s*\)/,
    'strategy report refresh should align worker signals to confirmed candle length before slicing',
  );
});

test('strategy signal consumers wait for the latest compute result to avoid flicker', () => {
  assert.match(
    simpleChartSource,
    /if \(message\.requestId !== this\.strategyRequestId\) return;/,
    'chart should ignore stale worker results when a newer strategy compute is pending',
  );
  assert.match(
    simpleChartSource,
    /public isStrategyComputePending\(\): boolean \{/,
    'chart should expose pending strategy compute state to UI consumers',
  );
  assert.match(
    initSource,
    /if \(pane\.chart\.isStrategyComputePending\?\.\(\)\) return \[\];/,
    'live signal popup scan should not announce from in-flight strategy output',
  );
  assert.match(
    initSource,
    /if \(pane\.chart\.isStrategyComputePending\?\.\(\)\) return;/,
    'top bar notification should keep the previous stable count during strategy recompute',
  );
  assert.match(
    strategyReportPanelSource,
    /if \(!message \|\| message\.requestId !== nextRequestId\) return;/,
    'strategy report worker should only apply the latest refresh result',
  );
  assert.match(
    strategyReportPanelSource,
    /if \(chart\.isStrategyComputePending\?\.\(\)\) \{/,
    'strategy report refresh should keep current trades visible while strategy signals are recomputing',
  );
});

test('gateway read/write paths use candle guards for stale history and corrupt rows', () => {
  assert.match(gatewayServerSource, /sanitizeCandleSeries\(parsed, \{/);
  assert.match(gatewayServerSource, /shouldResetCandleSeries\(current, sanitizedIncoming, \{/);
  assert.match(pagesCandlesSource, /sanitizeCandleSeries\(result1m\.rows, \{/);
  assert.match(pagesWebhookSource, /shouldResetCandleSeries\(existing, candles, \{/);
});

test('gateway server canonicalizes Nasdaq index futures to the futures store', () => {
  assert.match(
    gatewayServerSource,
    /function canonicalizeMarketSymbol\(marketRaw, symbolRaw\) \{[\s\S]*?return \{ market: 'futures', symbol: 'NQ1!' \};/,
    'NQ aliases should read and write through futures:NQ1! even when a request uses market=index',
  );
  assert.match(
    gatewayServerSource,
    /normalized === 'NAS100FT'[\s\S]*?normalized === 'NAS100\.FT'[\s\S]*?normalized === 'NAS100FUTURES'/,
    'broker aliases such as NAS100FT and NAS100 Futures should resolve to NQ1!',
  );
});

test('gateway live patches use incremental chart updates instead of full setData snapshots', () => {
  assert.match(
    gatewayLiveFeedSource,
    /const hasSameCandleValues = \(a: CandleDataLike, b: CandleDataLike\): boolean =>/,
    'gateway feed should compare live candle values before mutating the chart',
  );
  assert.match(
    gatewayLiveFeedSource,
    /if \(hasMiddleRepair \|\| \(hasNewerRows && current\.length \+ incoming\.filter\(\(row\) => row\.time > latestTime\)\.length > limit\)\) \{[\s\S]*?applySnapshot\(merged\);/,
    'gateway feed should reserve full snapshots for history repair or render-window trimming',
  );
  assert.match(
    gatewayLiveFeedSource,
    /if \(row\.time === latest\.time && !hasSameCandleValues\(latest, row\)\) \{[\s\S]*?chart\.updateLastCandle\(\{/,
    'current MT candle ticks should patch the last candle without clearing strategy signals',
  );
  assert.match(
    gatewayLiveFeedSource,
    /buyVolume: row\.buyVolume,[\s\S]*sellVolume: row\.sellVolume,[\s\S]*volumeDelta: row\.volumeDelta,[\s\S]*footprint: cloneFootprint\(row\.footprint\)/,
    'MT live patches should preserve CVD and footprint source fields',
  );
  assert.match(
    gatewayLiveFeedSource,
    /if \(row\.time > latest\.time\) \{\s*chart\.addNewCandle\(row\);/,
    'new completed MT candles should use the same incremental path as Binance',
  );
});
