import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SIGNAL_REALTIME_LAG_SECONDS,
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
