import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
const panelSource = fs.readFileSync(new URL('../src/ui/workspace/strategy-report-panel.ts', import.meta.url), 'utf8');
const chartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

test('strategy report panel skips calculation while hidden or collapsed', () => {
  assert.match(
    panelSource,
    /canRefresh: \(\) => boolean;/,
    'panel API should expose whether report calculation is currently allowed',
  );
  assert.match(
    panelSource,
    /const canRefresh = \(\): boolean => panelVisible && panelMode !== 'collapsed';/,
    'calculation gate should require the panel to be visible and not collapsed',
  );
  assert.match(
    panelSource,
    /const refresh = \(\) => \{\s*if \(!canRefresh\(\)\) return;/,
    'refresh should exit before report calculation when the panel is not calculable',
  );
  assert.match(
    panelSource,
    /const markStale = \(\) => \{\s*if \(!canRefresh\(\)\) \{\s*reportStale = true;\s*return;\s*\}[\s\S]*?const nextSignature = buildCurrentReportSignature\(\);/,
    'markStale should avoid signature scans while collapsed or hidden',
  );
});

test('chart boot does not schedule strategy report calculation until the report is open', () => {
  assert.match(
    initSource,
    /const refreshStrategyReportAfterComputed = \([\s\S]*?if \(strategyReportOpenByPane\.get\(paneId\) !== true && !canRefreshStrategyReport\(\)\) return false;[\s\S]*?forceRefreshStrategyReport\(\);/,
    'post-strategy-compute refresh should be gated by explicit report open state or an actually expanded report panel',
  );
  assert.doesNotMatch(
    initSource,
    /if \(!wasActive\) \{[\s\S]*?strategyReport\.refresh\(\);[\s\S]*?requestStrategyReportAfterNextCompute\(activePaneId\);[\s\S]*?\}/,
    'first strategy activation should not immediately refresh or schedule report calculation',
  );
});

test('expanded strategy report refreshes after timeframe recompute without manual refresh', () => {
  assert.match(
    initSource,
    /let canRefreshStrategyReport = \(\) => false;/,
    'app state should expose whether the mounted report panel is currently calculable',
  );
  assert.match(
    initSource,
    /canRefreshStrategyReport = \(\) => strategyReport\.canRefresh\(\);/,
    'mounted report panel should drive the calculable-state gate',
  );
  assert.match(
    initSource,
    /onModeChange: \(mode, prevMode\) => \{[\s\S]*?strategyReportOpenByPane\.set\(paneId, mode !== 'collapsed'\);/,
    'unfolding the report panel should mark it open for subsequent strategy recomputes',
  );
});

test('live current-candle patches do not schedule strategy recomputation', () => {
  const updateLastCandleMethod = chartSource.match(
    /public updateLastCandle\(td: Partial<CandleData>\) \{[\s\S]*?\n  \}/,
  )?.[0] ?? '';
  const addNewCandleMethod = chartSource.match(
    /public addNewCandle\(c: CandleData\) \{[\s\S]*?\n  \}/,
  )?.[0] ?? '';

  assert.match(
    updateLastCandleMethod,
    /this\.draw\(\);/,
    'live current-candle updates should keep drawing immediately',
  );
  assert.ok(updateLastCandleMethod, 'updateLastCandle method should be present');
  assert.ok(addNewCandleMethod, 'addNewCandle method should be present');
  assert.doesNotMatch(
    updateLastCandleMethod,
    /scheduleStrategyCompute/,
    'current-candle tick updates should not recompute strategy on every tick',
  );
  assert.match(
    addNewCandleMethod,
    /scheduleStrategyCompute/,
    'new completed candle boundaries should still recompute strategy candidates',
  );
});

test('live current-candle patches do not mark strategy report or signal notifications stale', () => {
  const updateHandlers = [...initSource.matchAll(
    /updateLastCandle: \(patch\) => \{[\s\S]*?\n\s*}\,(\r?\n\s*(?:}\,|limit:|onDataApplied:))/g,
  )].map((match) => match[0]);

  assert.ok(updateHandlers.length >= 3, 'expected fallback, binance, and gateway live update handlers');
  updateHandlers.forEach((handler) => {
    assert.doesNotMatch(
      handler,
      /markStrategyReportStale\(\)/,
      'current-candle live patches should not touch report stale state or signal notification counters',
    );
  });

  const addHandlers = [...initSource.matchAll(
    /addNewCandle: \(candle\) => \{[\s\S]*?\n\s*}\,/g,
  )].map((match) => match[0]);
  assert.ok(
    addHandlers.some((handler) => /markStrategyReportStale\(\)/.test(handler)),
    'completed candle boundaries should still mark the strategy report stale',
  );
});

test('manual strategy report refresh requests a fresh strategy recompute first', () => {
  assert.match(
    chartSource,
    /public recomputeStrategySignals\(changedFrom = 0\): void \{[\s\S]*?this\.scheduleStrategyCompute\(changedFrom, 0\);[\s\S]*?\}/,
    'chart should expose an explicit strategy recompute API for report refreshes',
  );
  assert.match(
    panelSource,
    /manualRefreshBtn\.addEventListener\('click', \(\) => \{[\s\S]*?onManualRefresh\?\.\(\);[\s\S]*?refresh\(\);[\s\S]*?\}\);/,
    'manual report refresh should request a fresh strategy recompute before refreshing',
  );
  assert.match(
    initSource,
    /onManualRefresh: \(\) => \{[\s\S]*?requestStrategyReportAfterNextCompute\(pane\.paneId\);[\s\S]*?pane\.chart\.recomputeStrategySignals\?\.\(0\);[\s\S]*?\}/,
    'the app should refresh the report after the explicit strategy recompute finishes',
  );
});
