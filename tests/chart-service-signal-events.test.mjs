import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createAsyncChartServiceRepository,
  createSignalEventDedupeId,
  createSignalRealtimeStream,
  getSignalRealtimeSubscriberCount,
  publishSignalRealtimeEvent,
  saveAsyncSignalEventFromTelegramEvent,
} from '../src/server/chart-service/index.ts';

test('signal realtime stream delivers matching signal events over SSE and cleans up', async () => {
  const stream = createSignalRealtimeStream({ symbolId: 'BTCUSDT', timeframe: '1m' }, {
    heartbeatMs: null,
    now: () => '2026-06-17T00:00:00.000Z',
  });
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  const retryChunk = decoder.decode((await reader.read()).value);
  const readyChunk = decoder.decode((await reader.read()).value);
  assert.match(retryChunk, /retry: 5000/);
  assert.match(readyChunk, /event: signals.ready/);
  assert.equal(getSignalRealtimeSubscriberCount(), 1);

  const event = createSignalEvent('BTCUSDT', '1m');
  assert.equal(publishSignalRealtimeEvent(createSignalEvent('ETHUSDT', '1m')), 0);
  assert.equal(publishSignalRealtimeEvent(event), 1);

  const signalChunk = decoder.decode((await reader.read()).value);
  assert.match(signalChunk, /event: signals.changed/);
  assert.match(signalChunk, /"symbolId":"BTCUSDT"/);

  await reader.cancel();
  assert.equal(getSignalRealtimeSubscriberCount(), 0);
});

test('saving async signal events persists and publishes the shared server event', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  const stream = createSignalRealtimeStream({}, { heartbeatMs: null });
  const reader = stream.getReader();
  await reader.read();
  await reader.read();

  const saved = await saveAsyncSignalEventFromTelegramEvent(repository, {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale Scalping',
    signalSource: 'chart_strategy',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 63000,
    occurredAt: '2026-06-17T01:00:00.000Z',
  }, {
    origin: 'browser_chart',
    now: '2026-06-17T01:00:01.000Z',
  });

  const events = await repository.listSignalEvents(10);
  const signalChunk = new TextDecoder().decode((await reader.read()).value);

  assert.equal(events.length, 1);
  assert.equal(events[0].id, saved.id);
  assert.equal(events[0].origin, 'browser_chart');
  assert.match(signalChunk, new RegExp(saved.id));

  await reader.cancel();
});

test('signal dedupe IDs ignore source labels but distinguish minute and monthly timeframes', () => {
  const baseEvent = {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    signalSource: 'chart_strategy',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    occurredAt: '2026-07-11T01:00:00.000Z',
  };
  const fallbackNow = '2026-07-11T01:00:01.000Z';
  const minuteId = createSignalEventDedupeId(baseEvent, fallbackNow);
  assert.equal(minuteId, createSignalEventDedupeId({ ...baseEvent, signalSource: 'ea_strategy' }, fallbackNow));
  assert.notEqual(minuteId, createSignalEventDedupeId({ ...baseEvent, timeframe: '1M' }, fallbackNow));
});

function createSignalEvent(symbolId, timeframe) {
  return {
    id: `signal_event_${symbolId}_${timeframe}`,
    eventType: 'buy',
    source: 'chart_strategy',
    origin: 'server_monitor',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale Scalping',
    symbolId,
    timeframe,
    price: 63000,
    stopLossPrice: null,
    takeProfitPrices: [],
    executionMode: null,
    fillModel: null,
    occurredAt: '2026-06-17T01:00:00.000Z',
    createdAt: '2026-06-17T01:00:01.000Z',
  };
}
