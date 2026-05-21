import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('src/chart/SimpleChart.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

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
