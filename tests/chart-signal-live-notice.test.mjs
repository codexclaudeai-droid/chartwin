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

test('chart signal notice only announces fresh local and server events', () => {
  assert.match(initSource, /const isFreshSignalNotice = \(timeSec: number, timeframe: string\): boolean =>/);
  assert.match(
    initSource,
    /return collectTodaySignalNotices\(paneId\)\.filter\(\(item\) => \{[\s\S]*?if \(!isFreshSignalNotice\(item\.timeSec, pane\.chart\.config\.timeframe\)\) \{[\s\S]*?announcedSignalKeys\.add\(item\.key\);[\s\S]*?return false;[\s\S]*?\}/,
  );
  assert.match(
    initSource,
    /const handleServerSignalEvent = \(signalEvent: ServerSignalEvent\) => \{[\s\S]*?if \(!isFreshSignalNotice\(timeSec, signalEvent\.timeframe \?\? ''\)\) return;/,
  );
});

test('chart signal notice posts new buy sell signals to Telegram alert API', () => {
  assert.match(initSource, /const postTelegramSignalAlert = \(paneId: number, signal: \{/);
  assert.match(initSource, /fetch\('\/api\/telegram-alerts\/signal'/);
  assert.match(initSource, /eventType: signal\.side === 'LONG' \? 'buy' : 'sell'/);
  assert.match(initSource, /strategyId/);
  assert.match(initSource, /strategyName/);
  assert.match(initSource, /signalSource: signalPolicy\?\.source \?\? 'chart_strategy'/);
  assert.doesNotMatch(initSource, /signalPolicy\.source !== 'chart_strategy'\) return;/);
  assert.doesNotMatch(initSource, /signalPolicy\.strategyId && signalPolicy\.strategyId !== strategyId\) return;/);
  assert.match(initSource, /postTelegramSignalAlert\(paneId, latestSignal\);/);
  assert.match(
    initSource,
    /if \(!latestSignal\) return;\s*postTelegramSignalAlert\(paneId, latestSignal\);\s*if \(document\.visibilityState !== 'visible'\) return;\s*showSignalNoticePopup\(latestSignal\);/,
  );
});

test('chart subscribes to server signal SSE events and deduplicates local signal keys', () => {
  assert.match(initSource, /new EventSource\('\/api\/signals\/stream'\)/);
  assert.match(initSource, /eventSource\.addEventListener\('signals\.changed', handleChanged\)/);
  assert.match(initSource, /parseServerSignalRealtimePayload/);
  assert.match(initSource, /const key = `\$\{pane\.paneId\}:\$\{symbol\}:\$\{timeSec\}:\$\{signalValue\}`;/);
  assert.match(initSource, /if \(announcedSignalKeys\.has\(key\)\) return;/);
  assert.match(initSource, /announcedSignalKeys\.add\(key\);/);
  assert.match(initSource, /void pane\.reloadLiveData\(\)\.then/);
});

test('chart signal notice refreshes the open strategy report after a new signal', () => {
  assert.match(
    initSource,
    /refreshStrategyReportOnNewSignal = \(paneId: number\) => \{[\s\S]*?strategyReportOpenByPane\.get\(paneId\) !== true[\s\S]*?forceRefreshStrategyReport\(\);[\s\S]*?refreshSignalNotification\(\);[\s\S]*?\};/,
  );
});
