import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
const panelSource = fs.readFileSync(new URL('../src/ui/workspace/strategy-report-panel.ts', import.meta.url), 'utf8');

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
