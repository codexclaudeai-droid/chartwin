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
  assert.match(initSource, /const isSignalNoticeSnapshotReady = \(paneId: number\): boolean => \{/);
  assert.match(
    initSource,
    /if \(!isSignalNoticeSnapshotReady\(paneId\)\) return \[\];/,
  );
  assert.match(
    initSource,
    /if \(signalNoticeSuppressNextReadyComputeByPane\.has\(paneId\) \|\| signalNoticeBaselineKeyByPane\.get\(paneId\) !== baselineKey\) \{[\s\S]*?markExistingTodaySignalsAnnounced\(paneId\);[\s\S]*?return \[\];/,
  );
});

test('chart signal notice suppresses reload backlogs and only announces the latest visible signal', () => {
  assert.match(initSource, /let suppressSignalNoticesUntilNextReadyCompute = \(_paneId: number\) => \{\};/);
  assert.match(initSource, /const signalNoticeSuppressNextReadyComputeByPane = new Set<number>\(\);/);
  assert.match(
    initSource,
    /suppressSignalNoticesUntilNextReadyCompute = \(paneId: number\) => \{[\s\S]*?signalNoticeSuppressNextReadyComputeByPane\.add\(paneId\);[\s\S]*?signalNoticeBaselineKeyByPane\.delete\(paneId\);[\s\S]*?\};/,
  );
  assert.match(
    initSource,
    /const reloadLiveData = async \(\) => \{[\s\S]*?suppressSignalNoticesUntilNextReadyCompute\(paneId\);[\s\S]*?const ok = await selectedFeed\.reload\(\);/,
  );
  assert.match(
    initSource,
    /if \(document\.visibilityState !== 'visible'\) return;/,
  );
  assert.match(
    initSource,
    /const latestSignal = detected[\s\S]*?\.sort\(\(a, b\) => a\.timeSec - b\.timeSec\)[\s\S]*?\.at\(-1\);/,
  );
  assert.match(initSource, /if \(!latestSignal\) return;/);
  assert.match(initSource, /showSignalNoticePopup\(latestSignal\);/);
  assert.match(initSource, /speakSignalNotice\(latestSignal\.side\);/);
});
