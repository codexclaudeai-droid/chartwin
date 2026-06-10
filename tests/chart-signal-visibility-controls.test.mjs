import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
const overlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const chartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

test('chart signal visibility controls use radio on/off icons', () => {
  assert.match(initSource, /const STRATEGY_SIGNAL_ON_SVG = \(size: number\): string => `[\s\S]*lucide-radio/);
  assert.match(initSource, /const STRATEGY_SIGNAL_OFF_SVG = \(size: number\): string => `[\s\S]*lucide-radio-off/);
  assert.match(initSource, /<path d="M16\.247 7\.761a6 6 0 0 1 0 8\.478"\/>/);
  assert.match(initSource, /<path d="m2 2 20 20"\/>/);
});

test('desktop signal visibility control is placed after the market session badge', () => {
  assert.match(
    initSource,
    /const strategySignalDesktopBtn = createStrategySignalVisibilityButton\([\s\S]*?marketSessionBadge\.insertAdjacentElement\('afterend', strategySignalDesktopBtn\);/,
  );
});

test('desktop signal visibility control has no outline border', () => {
  assert.match(
    initSource,
    /const strategySignalDesktopBtn = createStrategySignalVisibilityButton\(\{[\s\S]*?style: '[^']*border:none;[^']*'/,
  );
});

test('mobile signal visibility control is placed after the indicator button', () => {
  assert.match(
    initSource,
    /mobileBarEl\.appendChild\(indMobileBtn\);[\s\S]*?const signalMobileBtn = createStrategySignalVisibilityButton\([\s\S]*?mobileBarEl\.appendChild\(signalMobileBtn\);/,
  );
});

test('signal visibility toggles use lightweight UI sync instead of full chart refresh', () => {
  assert.match(
    initSource,
    /const refreshSignalVisibilityUi = \(\) => \{[\s\S]*?refreshStrategySignalDesktopButton\(\);[\s\S]*?refreshOverlay\(\);[\s\S]*?\};/,
  );
  assert.doesNotMatch(
    initSource,
    /const strategySignalDesktopBtn = createStrategySignalVisibilityButton\(\{[\s\S]*?onAfterToggle: \(\) => \{\s*refreshChartUi\(\);[\s\S]*?\}/,
  );
  assert.doesNotMatch(
    initSource,
    /const signalMobileBtn = createStrategySignalVisibilityButton\(\{[\s\S]*?onAfterToggle: \(\) => \{\s*getActivePane\(\)\.refreshChartUi\(\);[\s\S]*?\}/,
  );
});

test('signal visibility toggles synchronize every control in the active pane', () => {
  assert.match(
    overlaySource,
    /export function createIndicatorOverlay\([\s\S]*?onOverlayChange\?: \(\) => void,[\s\S]*?onSignalVisibilityChange\?: \(\) => void,[\s\S]*?\): \(\) => void/,
    'indicator overlay should accept a lightweight signal visibility sync callback',
  );
  assert.match(
    overlaySource,
    /chart\.setStrategySignalVisible\?\.\(nextVisible\);[\s\S]*?onSignalVisibilityChange\?\.\(\);/,
    'strategy tag eye button should sync sibling controls after toggling visibility',
  );
  assert.match(
    initSource,
    /const refreshOverlay = createIndicatorOverlay\(chartArea, chart, \(\) => \{[\s\S]*?\}, \(\) => \{[\s\S]*?refreshSignalVisibilityUi\(\);[\s\S]*?\}\);/,
    'pane setup should wire overlay toggles into the same lightweight sync path',
  );
});

test('signal visibility setter always schedules a deterministic signal-layer repaint', () => {
  assert.match(
    chartSource,
    /public setStrategySignalVisible\(visible: boolean\): void \{[\s\S]*?this\.strategySignalVisible = visible;[\s\S]*?this\.requestSignalLayerDraw\(\);[\s\S]*?this\.updateSignalAnimationLoop\(\);/,
    'visibility changes should always schedule a signal layer pass so rapid toggles settle deterministically',
  );
  assert.doesNotMatch(
    chartSource,
    /public setStrategySignalVisible\(visible: boolean\): void \{[\s\S]*?if \(visible\) \{[\s\S]*?this\.requestSignalLayerDraw\(\);[\s\S]*?\} else \{[\s\S]*?this\.clearSignalLayer\(\);[\s\S]*?\}/,
    'setter should not split on/off into different paint paths',
  );
});
