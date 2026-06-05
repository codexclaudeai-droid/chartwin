import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

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
