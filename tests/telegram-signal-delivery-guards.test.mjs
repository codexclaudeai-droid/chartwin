import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  sendAsyncTelegramAlertForSignalWithWatchState,
} from '../src/server/chart-service/index.ts';

function createProfile() {
  return {
    id: 'telegram_profile_delivery_guard',
    name: 'Delivery Guard Bot',
    botToken: '123456789:ABCDEF_secret_token',
    chatId: '-1001234567890',
    isEnabled: true,
    eventTypes: ['buy', 'sell'],
    strategyIds: ['strategy_js_grid_martingale'],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

test('browser Telegram delivery suppresses stale events and never regresses watch state', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  await repository.saveTelegramBotProfile(createProfile());
  await repository.saveTelegramSignalWatchState({
    key: 'strategy_js_grid_martingale:BTCUSDT:1m',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 300,
    lastSignalCandleTime: 240,
    lastSignalEventType: 'sell',
    updatedAt: '1970-01-01T00:05:00.000Z',
  });

  const result = await sendAsyncTelegramAlertForSignalWithWatchState(repository, {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    signalSource: 'chart_strategy',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 98,
    occurredAt: '1970-01-01T00:01:00.000Z',
  }, async () => {
    throw new Error('stale signal should not reach Telegram');
  }, { now: '1970-01-01T00:10:00.000Z' });

  const state = await repository.getTelegramSignalWatchState('strategy_js_grid_martingale:BTCUSDT:1m');
  assert.equal(result.suppressedCount, 1);
  assert.equal(result.sentCount, 0);
  assert.equal(state?.lastCheckedCandleTime, 300);
  assert.equal(state?.lastSignalCandleTime, 240);
  assert.equal(state?.lastSignalEventType, 'sell');
});

test('concurrent browser and server paths claim the same logical signal once across source labels', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  await repository.saveTelegramBotProfile(createProfile());
  const event = {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    signalSource: 'ea_strategy',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 101,
    occurredAt: '1970-01-01T00:05:00.000Z',
  };
  const sentMessages = [];
  const fetcher = async (_url, init) => {
    sentMessages.push(JSON.parse(init.body).text);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: sentMessages.length } }),
    };
  };

  const results = await Promise.all([
    sendAsyncTelegramAlertForSignalWithWatchState(
      repository,
      event,
      fetcher,
      { origin: 'browser_chart', now: '1970-01-01T00:06:10.000Z' },
    ),
    sendAsyncTelegramAlertForSignalWithWatchState(
      repository,
      { ...event, signalSource: 'chart_strategy' },
      fetcher,
      { origin: 'server_monitor', now: '1970-01-01T00:06:10.000Z' },
    ),
  ]);

  assert.equal(sentMessages.length, 1);
  assert.equal(results.reduce((sum, result) => sum + result.sentCount, 0), 1);
  assert.equal(results.reduce((sum, result) => sum + result.suppressedCount, 0), 1);
  assert.equal((await repository.listSignalEvents(10)).length, 1);
});

test('watch state writes stay monotonic when an older request finishes last', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  const base = {
    key: 'strategy_js_grid_martingale:BTCUSDT:1m',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
  };
  await repository.saveTelegramSignalWatchState({
    ...base,
    lastCheckedCandleTime: 600,
    lastSignalCandleTime: 540,
    lastSignalEventType: 'sell',
    updatedAt: '1970-01-01T00:10:00.000Z',
  });
  await repository.saveTelegramSignalWatchState({
    ...base,
    lastCheckedCandleTime: 300,
    lastSignalCandleTime: 240,
    lastSignalEventType: 'buy',
    updatedAt: '1970-01-01T00:05:00.000Z',
  });

  const state = await repository.getTelegramSignalWatchState(base.key);
  assert.equal(state?.lastCheckedCandleTime, 600);
  assert.equal(state?.lastSignalCandleTime, 540);
  assert.equal(state?.lastSignalEventType, 'sell');
  assert.equal(state?.updatedAt, '1970-01-01T00:10:00.000Z');
});
