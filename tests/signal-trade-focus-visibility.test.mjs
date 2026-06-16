import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('src/chart/SimpleChart.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const tradeFocusRendererPath = path.resolve('src/chart/renderers/trade-focus-overlay-renderer.ts');
const tradeFocusRendererSource = fs.readFileSync(tradeFocusRendererPath, 'utf8');
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
    tradeFocusRendererSource,
    /if \(focusedTradeRange\.type === 'connector' && mainScale\) \{/,
    'overlay rendering should branch closed trades into connector mode',
  );
  assert.match(
    tradeFocusRendererSource,
    /ctx\.setLineDash\(\[1, 2\]\);/,
    'connector mode should match the live-price dashed style',
  );
  assert.match(
    tradeFocusRendererSource,
    /drawPriceLineOverlay\(\{[\s\S]*label: 'ENTRY'[\s\S]*drawPriceLineOverlay\(\{[\s\S]*label: 'EXIT'/s,
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

test('mouse hover alone does not clear an active trade focus on desktop', () => {
  assert.doesNotMatch(
    source,
    /private handleMouseMove\(e: MouseEvent\) \{[\s\S]*if \(this\.focusedTradeRange && !this\.drawingMoveState && !this\.drawingTool\) \{\s*this\.clearTradeFocusVisual\(\);\s*\}/s,
    'desktop mouse move should not immediately clear trade focus overlays',
  );
});

test('trade focus overlay does not keep reanimating while crosshair interaction is active', () => {
  assert.match(
    tradeFocusRendererSource,
    /if \(!isMouseOver && focusedTradeRange\.type !== 'connector'\) \{\s*requestOverlayDraw\(\);\s*\}/s,
    'focused trade overlay should only self-schedule while passive box highlighting is active',
  );
  assert.doesNotMatch(
    source,
    /\n\s*this\.requestOverlayDraw\(\);\s*\n\s*}\s*\n\s*}\s*\n\s*if \(this\.gotoDateMarker && mainScale\)/s,
    'focused trade overlay should not unconditionally reschedule every overlay frame',
  );
});

test('trade rows do not trigger chart focus until the explicit confirm button is pressed', () => {
  assert.doesNotMatch(
    panelSource,
    /rowEl\.addEventListener\('click', \(\) => \{\s*const trade = displayedTrades\[idx\];\s*if \(!trade\) return;\s*moveToTradeSignal\(trade\);\s*\}\);/s,
    'trade table row clicks should not immediately trigger chart focus',
  );
  assert.match(
    panelSource,
    /moveBtn\.addEventListener\('click', \(event\) => \{\s*event\.stopPropagation\(\);\s*const trade = displayedTrades\[idx\];\s*if \(!trade\) return;\s*moveToTradeSignal\(trade\);\s*\}\);/s,
    'explicit confirm button should remain the trigger for chart focus',
  );
});

test('trade focus remains active during normal desktop mouse movement', () => {
  assert.match(
    source,
    /private clearTradeFocusVisual\(\): void \{[\s\S]*?this\.focusedTradeRange = null;[\s\S]*?this\.focusedSignalCandleIndex = null;[\s\S]*?this\.focusVisualStartedAt = 0;[\s\S]*?this\.clearFocusVisualTimer\(\);[\s\S]*?\}/s,
    'trade focus should still expose a single reset helper for explicit dismissal paths',
  );
  assert.doesNotMatch(
    source,
    /private handleMouseMove\(e: MouseEvent\) \{[\s\S]*?if \(this\.focusedTradeRange && !this\.drawingMoveState && !this\.drawingTool\) \{\s*this\.clearTradeFocusVisual\(\);\s*\}[\s\S]*?this\.isMouseOver = true;/s,
    'normal desktop mouse movement should not clear trade focus overlays before crosshair updates',
  );
});

test('latest signal animation is temporary and trade focus suppresses pulse drawing', () => {
  assert.match(
    source,
    /const LATEST_SIGNAL_ANIMATION_DURATION_MS\s*=\s*4500;/,
    'latest signal animation should be bounded instead of running forever',
  );
  assert.match(
    source,
    /private isLatestSignalAnimationLive\(timeMs = performance\.now\(\)\): boolean \{[\s\S]*?return this\.latestSignalAnimationUntilMs > 0 && timeMs < this\.latestSignalAnimationUntilMs;[\s\S]*?\}/,
    'chart should expose a time gate for latest-signal pulse rendering',
  );
  assert.match(
    source,
    /const shouldAnimate = this\.strategySignalVisible[\s\S]*?&& this\.focusedTradeRange == null[\s\S]*?&& this\.isLatestSignalAnimationLive\(nowMs\);/,
    'latest signal animation should pause while focused and expire after the bounded window',
  );
  assert.match(
    source,
    /private clearTradeFocusVisual\(\): void \{[\s\S]*?this\.clearFocusVisualTimer\(\);[\s\S]*?this\.updateSignalAnimationLoop\(\);[\s\S]*?\}/s,
    'clearing trade focus should resume the normal latest-signal animation loop',
  );
  assert.match(
    source,
    /private clearTradeFocusVisual\(\): void \{[\s\S]*?this\.drawSignalLayer\(this\.lastDrawMeta\);[\s\S]*?\}/s,
    'clearing trade focus should immediately redraw the signal layer without focused visuals',
  );
  assert.match(
    source,
    /this\.focusedTradeRange = \{[\s\S]*?\};\s*this\.updateSignalAnimationLoop\(\);\s*this\.draw\(\);\s*this\.focusSignalVisual\(this\.focusedTradeRange\.startIndex, options\);/s,
    'entering trade focus should immediately pause latest signal animation before drawing the focused range',
  );
  assert.match(
    source,
    /const shouldPulseLatest = isLatest && this\.isLatestSignalAnimationLive\(timeMs\);/,
    'non-animated signal redraws should render the latest signal statically after the pulse window',
  );
});

test('trades tab render path skips hidden metrics chart work', () => {
  assert.match(
    panelSource,
    /if \(activeTab === 'metrics'\) \{[\s\S]*?renderKpi\(\);[\s\S]*?renderLegend\(\);[\s\S]*?drawChart\(\);[\s\S]*?if \(panelMode === 'expanded'\) \{[\s\S]*?renderExpandedSections\(\);[\s\S]*?\} else \{[\s\S]*?expandedSections\.innerHTML = '';\s*\}[\s\S]*?\} else \{[\s\S]*?legendRow\.innerHTML = '';\s*expandedSections\.innerHTML = '';\s*renderTradesTable\(\);[\s\S]*?\}/s,
    'renderAll should avoid hidden metrics rendering work while the trades tab is active',
  );
});

test('trade alert updates do not rebuild the entire trades table once it is already rendered', () => {
  assert.match(
    panelSource,
    /const syncTradeViewAlertButtons = \(\) => \{[\s\S]*?classList\.toggle\('strategy-trade-view-alert', tradeViewAlertActive\);[\s\S]*?\}/s,
    'trade alert state changes should update existing confirm buttons in place',
  );
  assert.match(
    panelSource,
    /if \(\s*lastRenderedTradesResult === r[\s\S]*?tradesView\.firstElementChild\s*\) \{\s*syncTradeViewAlertButtons\(\);\s*return;\s*\}/s,
    'trade table rendering should reuse the existing table when the result and layout are unchanged',
  );
  assert.match(
    panelSource,
    /setTradeViewAlertActive: \(active: boolean\) => \{\s*const nextActive = Boolean\(active\);\s*if \(tradeViewAlertActive === nextActive\) return;\s*tradeViewAlertActive = nextActive;\s*if \(activeTab === 'trades' && tradesView\.firstElementChild\) \{\s*syncTradeViewAlertButtons\(\);\s*\}\s*\}/s,
    'trade alert toggles should avoid forcing a full trades table rerender',
  );
});
