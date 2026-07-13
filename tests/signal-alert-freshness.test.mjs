import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_SIGNAL_REALTIME_LAG_SECONDS,
  isSignalRealtimeEmissionWithinWindow,
  isSignalWithinRealtimeWindow,
} from '../src/strategy/signal-freshness.ts';

test('signal realtime window is measured from candle confirmation time', () => {
  assert.equal(DEFAULT_SIGNAL_REALTIME_LAG_SECONDS, 90);
  assert.equal(isSignalWithinRealtimeWindow({
    signalTimeSec: 60,
    timeframe: '1m',
    nowSec: 60 + 60 + 90,
  }), true);
  assert.equal(isSignalWithinRealtimeWindow({
    signalTimeSec: 60,
    timeframe: '1m',
    nowSec: 60 + 60 + 91,
  }), false);
});

test('signal realtime window handles longer timeframes without treating candle open time as stale', () => {
  assert.equal(isSignalWithinRealtimeWindow({
    signalTimeSec: 3_600,
    timeframe: '1h',
    nowSec: 3_600 + 3_600 + 30,
  }), true);
});

test('fresh SSE emission can announce a newly detected revised signal without widening candle freshness', () => {
  assert.equal(isSignalRealtimeEmissionWithinWindow({
    emittedAtSec: 300,
    nowSec: 390,
  }), true);
  assert.equal(isSignalRealtimeEmissionWithinWindow({
    emittedAtSec: 300,
    nowSec: 391,
  }), false);

  const appSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  assert.match(
    appSource,
    /handleServerSignalEvent\(payload\.signalEvent, payload\.emittedAt\)/,
  );
  assert.match(
    appSource,
    /isFreshSignalNotice\(timeSec, signalEvent\.timeframe \?\? ''\)[\s\S]*?isSignalRealtimeEmissionWithinWindow/,
  );
});
