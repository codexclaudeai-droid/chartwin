import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const initSource = readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

test('chart signal notice runs immediately after strategy computation', () => {
  assert.match(initSource, /let notifyLiveSignalsForPane = \(_paneId: number\) => \{\};/);
  assert.match(
    initSource,
    /chart\.onStrategyComputed = \(\) => \{[\s\S]*?notifyLiveSignalsForPane\(paneId\);[\s\S]*?\};/,
  );
});

test('chart signal notice primes existing daily signals instead of replaying backlog', () => {
  assert.match(initSource, /const signalNoticeBaselineKeyByPane = new Map<number, string>\(\);/);
  assert.match(initSource, /const markExistingTodaySignalsAnnounced = \(paneId: number\) => \{/);
  assert.match(
    initSource,
    /if \(signalNoticeBaselineKeyByPane\.get\(paneId\) !== baselineKey\) \{[\s\S]*?markExistingTodaySignalsAnnounced\(paneId\);[\s\S]*?return;/,
  );
});
