import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('src/chart/SimpleChart.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const panelSourcePath = path.resolve('src/ui/workspace/strategy-report-panel.ts');
const panelSource = fs.readFileSync(panelSourcePath, 'utf8');

test('trade signal focus keeps overlays alive for at least 24 seconds', () => {
  assert.match(
    source,
    /private static readonly FOCUS_VISUAL_DURATION_MS = 24000;/,
    'signal focus duration should be extended to at least 24 seconds',
  );
  assert.match(
    source,
    /}, SimpleChart\.FOCUS_VISUAL_DURATION_MS\);/,
    'focus cleanup timer should use the shared extended duration constant',
  );
});

test('live price line and box are hidden while trade signal focus is active', () => {
  assert.match(
    source,
    /private shouldHideLivePriceOverlay\(\): boolean \{\s*return this\.focusedTradeRange != null;\s*\}/s,
    'trade focus should expose a dedicated live-price visibility guard',
  );
  assert.match(
    source,
    /const hideLivePriceOverlay = this\.shouldHideLivePriceOverlay\(\);\s*if \(this\.data\.length && mainScale && linearToY && !hideLivePriceOverlay\) \{/s,
    'current price overlay should be skipped while the trade focus overlay is active',
  );
});

test('closed trades use a profit or loss dashed connector instead of a pulsing range box', () => {
  assert.match(
    source,
    /type: 'box' \| 'connector';/,
    'focused trade metadata should distinguish between box and connector overlays',
  );
  assert.match(
    source,
    /if \(this\.focusedTradeRange\.type === 'connector' && mainScale\) \{/,
    'overlay rendering should branch closed trades into connector mode',
  );
  assert.match(
    source,
    /ctx\.setLineDash\(\[1, 2\]\);/,
    'connector mode should match the live-price dashed style',
  );
  assert.match(
    source,
    /drawPriceLineOverlay\(ctx, \{[\s\S]*label: 'ENTRY'[\s\S]*drawPriceLineOverlay\(ctx, \{[\s\S]*label: 'EXIT'/s,
    'connector mode should reuse the common price-line overlay labels for entry and exit',
  );
});

test('trade focus keeps extra surrounding candles visible around the selected range', () => {
  assert.match(
    source,
    /const minVisible = 24;/,
    'focused trade viewport should guarantee wider surrounding context',
  );
  assert.match(
    panelSource,
    /const padding = trade\.status === 'OPEN'\s*\? \(panelMode === 'expanded' \? 12 : 10\)\s*:\s*\(panelMode === 'expanded' \? 16 : 12\);/s,
    'trade signal jump should request larger side padding for closed and open positions',
  );
});

test('open trades preserve the previous visible candle count instead of zooming in', () => {
  assert.match(
    source,
    /preserveVisibleCount\?: boolean;/,
    'focus options should support preserving the current visible candle count',
  );
  assert.match(
    source,
    /if \(options\?\.preserveVisibleCount\) \{\s*normalizedRange = this\.moveViewportToIndexWithVisibleCount\(/s,
    'open-trade focus should use a viewport move path that keeps the previous zoom level',
  );
  assert.match(
    panelSource,
    /focusType: trade\.status === 'OPEN' \? 'box' : 'connector',[\s\S]*preserveVisibleCount: trade\.status === 'OPEN'/s,
    'strategy report should request visible-count preservation for open trades',
  );
});
