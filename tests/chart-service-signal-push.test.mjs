import assert from 'node:assert/strict';
import test from 'node:test';

import { SUBSCRIPTION_STATUSES } from '../src/domain/chart-service/index.ts';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  buildStrategyDefinition,
  notifyAsyncSignalPushSubscribers,
  runTelegramSignalMonitorOnce,
} from '../src/server/chart-service/index.ts';

const now = '2026-06-15T00:05:00.000Z';

test('signal app push targets active free trial and active subscribers while blocking expired subscriptions', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  syncRepository.saveSubscription({
    id: 'sub_trial',
    userId: 'user_trial',
    planId: null,
    status: SUBSCRIPTION_STATUSES.trialActive,
    startsAt: '2026-06-10T00:00:00.000Z',
    endsAt: '2026-06-20T00:00:00.000Z',
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  });
  syncRepository.saveSubscription({
    id: 'sub_pending',
    userId: 'user_member',
    planId: 'plan_monthly',
    status: SUBSCRIPTION_STATUSES.active,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-06-14T23:59:00.000Z',
    approvedByAdminId: 'admin_1',
    approvedAt: '2026-06-01T00:00:00.000Z',
    cancelledAt: null,
    refundedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  const result = await notifyAsyncSignalPushSubscribers(repository, {
    eventType: 'buy',
    strategyId: 'strategy_test',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 65000,
    occurredAt: now,
  });

  assert.equal(result.eligibleUserCount, 2);
  assert.equal(result.notificationCount, 2);
  assert.equal(syncRepository.listNotificationsByUserId('user_trial').length, 1);
  assert.equal(syncRepository.listNotificationsByUserId('user_subscriber').length, 1);
  assert.equal(syncRepository.listNotificationsByUserId('user_member').length, 0);

  const notification = syncRepository.listNotificationsByUserId('user_subscriber')[0];
  assert.equal(notification.category, 'signal');
  assert.equal(notification.title, '매수신호발생');
  assert.match(notification.body, /BTCUSDT/);
  assert.match(notification.body, /1m/);
  assert.equal(notification.linkUrl, '/chart');
});

test('server signal monitor creates PWA signal notifications for eligible subscribers on new closed signals', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const strategy = buildStrategyDefinition({
    id: 'strategy_test_server_push',
    name: 'Server Push Strategy',
    description: 'Signals buy on bullish candles',
    language: 'javascript',
    sourceCode: `(
      function(context, index) {
        return context.close[index] > context.open[index] ? 1 : 0;
      }
    )`,
  });
  await repository.saveTelegramBotProfile({
    id: 'telegram_profile_server_push',
    name: 'Server Push Profile',
    botToken: '123456789:ABCDEF_secret_token',
    chatId: '-1001234567890',
    isEnabled: true,
    eventTypes: ['buy', 'sell'],
    strategyIds: [strategy.id],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    createdAt: now,
    updatedAt: now,
  });

  const candleSets = [
    [
      { time: 1_781_481_600, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 1_781_481_660, open: 11, high: 13, low: 10, close: 12, volume: 1 },
    ],
    [
      { time: 1_781_481_660, open: 11, high: 13, low: 10, close: 12, volume: 1 },
      { time: 1_781_481_720, open: 12, high: 14, low: 11, close: 13, volume: 1 },
    ],
  ];
  let fetchIndex = 0;

  const options = {
    now: '2026-06-15T00:03:05.000Z',
    strategies: [strategy],
    candleProvider: async () => candleSets[Math.min(fetchIndex++, candleSets.length - 1)],
    telegramFetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    }),
  };

  const seed = await runTelegramSignalMonitorOnce(repository, options);
  const realtime = await runTelegramSignalMonitorOnce(repository, options);

  assert.equal(seed.seededCount, 1);
  assert.equal(seed.pushNotificationCount, 0);
  assert.equal(realtime.sentCount, 1);
  assert.equal(realtime.pushNotificationCount, 1);
  assert.equal(syncRepository.listNotificationsByUserId('user_subscriber').length, 1);
  assert.equal(syncRepository.listNotificationsByUserId('user_trial').length, 0);
});
