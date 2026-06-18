import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createMockChartServiceRepository,
  createAsyncChartServiceRepository,
  createPostgresAsyncChartServiceRepository,
  buildStrategyDefinition,
  formatTelegramSignalMessage,
  getEnabledTelegramProfilesForSignal,
  maskTelegramBotToken,
  runTelegramSignalMonitorOnce,
  sendAsyncTelegramAlertForSignal,
  sendAsyncTelegramAlertForSignalWithWatchState,
  sendTelegramAlertForSignal,
  toPublicTelegramBotProfile,
} from '../src/server/chart-service/index.ts';
import { DEFAULT_SIGNAL_POLICY_SETTINGS } from '../src/domain/chart-service/index.ts';

const now = '2026-06-11T00:00:00.000Z';

function createProfile(overrides = {}) {
  return {
    id: overrides.id ?? 'telegram_profile_1',
    name: overrides.name ?? 'Test Bot',
    botToken: overrides.botToken ?? '123456789:ABCDEF_secret_token',
    chatId: overrides.chatId ?? '-1001234567890',
    isEnabled: overrides.isEnabled ?? true,
    eventTypes: overrides.eventTypes ?? ['buy', 'sell', 'stop_loss', 'take_profit'],
    strategyIds: overrides.strategyIds ?? ['strategy_js_grid_martingale'],
    symbolIds: overrides.symbolIds ?? ['BTCUSDT'],
    timeframeIds: overrides.timeframeIds ?? [],
    lastTestedAt: overrides.lastTestedAt ?? null,
    lastTestStatus: overrides.lastTestStatus ?? null,
    lastTestError: overrides.lastTestError ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

test('mock repository persists multiple Telegram bot profiles and delivery logs', () => {
  const repository = createMockChartServiceRepository();
  const testProfile = createProfile({ id: 'telegram_profile_test', name: 'Test Bot' });
  const prodProfile = createProfile({ id: 'telegram_profile_prod', name: 'Prod Bot', chatId: '-100999' });

  repository.saveTelegramBotProfile(testProfile);
  repository.saveTelegramBotProfile(prodProfile);

  assert.deepEqual(
    repository.listTelegramBotProfiles().map((profile) => profile.id),
    ['telegram_profile_test', 'telegram_profile_prod'],
  );

  repository.saveTelegramDeliveryLog({
    id: 'telegram_delivery_1',
    profileId: testProfile.id,
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    message: 'BUY BTCUSDT',
    status: 'sent',
    telegramMessageId: '42',
    errorMessage: null,
    createdAt: now,
  });

  assert.equal(repository.listTelegramDeliveryLogs(10).length, 1);
});

test('Telegram public profile masks bot token and never exposes the raw token', () => {
  const profile = createProfile({ botToken: '987654321:SUPER_SECRET_TOKEN' });
  const publicProfile = toPublicTelegramBotProfile(profile);

  assert.equal(maskTelegramBotToken(profile.botToken), '987654...OKEN');
  assert.equal(publicProfile.maskedBotToken, '987654...OKEN');
  assert.equal('botToken' in publicProfile, false);
  assert.equal(JSON.stringify(publicProfile).includes('SUPER_SECRET_TOKEN'), false);
});

test('Telegram signal delivery filters enabled profiles by event, strategy and symbol', async () => {
  const repository = createMockChartServiceRepository();
  repository.saveTelegramBotProfile(createProfile({ id: 'telegram_profile_match' }));
  repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_wrong_symbol',
    symbolIds: ['ETHUSDT'],
  }));
  repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_disabled',
    isEnabled: false,
  }));

  const event = {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1h',
    price: 65000,
    occurredAt: now,
  };

  assert.deepEqual(
    getEnabledTelegramProfilesForSignal(repository, event).map((profile) => profile.id),
    ['telegram_profile_match'],
  );

  const requests = [];
  const result = await sendTelegramAlertForSignal(repository, event, async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, result: { message_id: 77 } };
      },
    };
  });

  assert.equal(result.sentCount, 1);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /api\.telegram\.org\/bot123456789:ABCDEF_secret_token\/sendMessage/);
  assert.equal(requests[0].body.chat_id, '-1001234567890');
  assert.match(requests[0].body.text, /BUY/);
  assert.match(requests[0].body.text, /BTCUSDT/);
  assert.equal(repository.listTelegramDeliveryLogs(10)[0].status, 'sent');
});

test('Telegram signal delivery filters enabled profiles by timeframe when configured by admin', () => {
  const repository = createMockChartServiceRepository();
  repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_1h',
    timeframeIds: ['1h'],
  }));
  repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_15m',
    timeframeIds: ['15m'],
  }));
  repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_all_tf',
    timeframeIds: [],
  }));

  const event = {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1h',
    price: 65000,
    occurredAt: now,
  };

  assert.deepEqual(
    getEnabledTelegramProfilesForSignal(repository, event).map((profile) => profile.id),
    ['telegram_profile_1h', 'telegram_profile_all_tf'],
  );
});

test('Telegram signal message omits strategy and formats combined S/L and T/P levels', () => {
  const message = formatTelegramSignalMessage({
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1h',
    price: 65000,
    stopLossPrice: 64000,
    takeProfitPrices: [66000, 67000],
    occurredAt: '2026-06-11T13:45:00.000Z',
  });

  assert.match(message, /^⚡ TC Signal\n📈 BUY BTCUSDT/);
  assert.match(message, /TF: 1h/);
  assert.match(message, /Price: 65000/);
  assert.match(message, /S\/L: 64000/);
  assert.match(message, /T\/P: 66000, 67000/);
  assert.match(message, /Time: 26\.06\.11 22:45:00 KST/);
  assert.doesNotMatch(message, /2026-06-11T13:45:00\.000Z/);
  assert.doesNotMatch(message, /Strategy:/);
  assert.doesNotMatch(message, /Grid Martingale/);
});

test('Telegram exit event labels use S/L and T/P abbreviations', () => {
  assert.match(formatTelegramSignalMessage({
    eventType: 'stop_loss',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    occurredAt: now,
  }), /^⚡ TC Signal\n🛑 S\/L BTCUSDT/);
  assert.match(formatTelegramSignalMessage({
    eventType: 'take_profit',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    occurredAt: now,
  }), /^⚡ TC Signal\n🎯 T\/P BTCUSDT/);
});

test('Telegram signal message prefixes sell signals and gateway symbols with emojis', () => {
  const message = formatTelegramSignalMessage({
    eventType: 'sell',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'NQ1!',
    timeframe: '1m',
    price: 30574.65,
    occurredAt: '2026-06-16T13:49:00.000Z',
  });

  assert.match(message, /^⚡ TC Signal\n📉 SELL NAS100 Futures/);
  assert.doesNotMatch(message, /NQ1!/);
  assert.match(message, /TF: 1m/);
  assert.match(message, /Price: 30574.65/);
});

test('Telegram signal message uses a gold-bar style emoji for XAU symbols', () => {
  const message = formatTelegramSignalMessage({
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'XAUUSD',
    timeframe: '1m',
    price: 2350.5,
    occurredAt: '2026-06-16T13:49:00.000Z',
  });

  assert.match(message, /^⚡ TC Signal\n📈 BUY XAUUSD/);
});

test('async Telegram signal delivery supports API route persistence', async () => {
  const repository = createMockChartServiceRepository();
  repository.saveTelegramBotProfile(createProfile({ id: 'telegram_profile_async' }));
  const asyncRepository = createAsyncChartServiceRepository(repository);

  const result = await sendAsyncTelegramAlertForSignal(asyncRepository, {
    eventType: 'sell',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: 'Grid Martingale',
    symbolId: 'btcusdt',
    timeframe: '15m',
    price: 64000,
    occurredAt: now,
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, result: { message_id: 88 } };
    },
  }));

  assert.equal(result.sentCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(repository.listTelegramDeliveryLogs(10)[0].eventType, 'sell');
  assert.equal(repository.listTelegramDeliveryLogs(10)[0].symbolId, 'BTCUSDT');
});

test('admin dashboard exposes Telegram Alerts as a dedicated menu section', () => {
  const sectionsSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-sections.ts', import.meta.url), 'utf8');
  const shellSource = fs.readFileSync(new URL('../app/admin/admin-dashboard-shell.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');

  assert.match(sectionsSource, /telegramAlerts/);
  assert.match(sectionsSource, /#admin-telegram-alerts/);
  assert.match(shellSource, /Send/);
  assert.match(pageSource, /AdminTelegramAlertsPanel/);
});

test('database schema includes Telegram profile and delivery log tables', () => {
  const schemaSource = fs.readFileSync(new URL('../src/server/chart-service/database-schema.ts', import.meta.url), 'utf8');

  assert.match(schemaSource, /telegram_bot_profiles/);
  assert.match(schemaSource, /telegram_delivery_logs/);
  assert.match(schemaSource, /telegram_signal_watch_states/);
  assert.match(schemaSource, /bot_token/);
  assert.match(schemaSource, /chat_id/);
  assert.match(schemaSource, /timeframe_ids_json/);
});

test('postgres Telegram repository lazily creates alert tables without touching existing data tables', async () => {
  const statements = [];
  const repository = createPostgresAsyncChartServiceRepository({
    async query(statement) {
      statements.push(statement.sql);
      return { rows: [] };
    },
  });

  await repository.listTelegramBotProfiles();
  await repository.listTelegramDeliveryLogs();

  assert.equal(
    statements.filter((sql) => /create table if not exists telegram_bot_profiles/i.test(sql)).length,
    1,
  );
  assert.equal(
    statements.filter((sql) => /create table if not exists telegram_delivery_logs/i.test(sql)).length,
    1,
  );
  assert.equal(
    statements.some((sql) => /create table if not exists users/i.test(sql) || /delete from/i.test(sql)),
    false,
  );
});

test('server Telegram monitor seeds existing latest signal before sending realtime signals once', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const strategy = buildStrategyDefinition({
    id: 'strategy_test_green_candle',
    name: 'Green Candle Test',
    description: 'Signals buy on bullish candles',
    language: 'javascript',
    sourceCode: `(
      function(context, index) {
        return context.close[index] > context.open[index] ? 1 : 0;
      }
    )`,
  });
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_server_monitor',
    strategyIds: [strategy.id],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));

  const candleSets = [
    [
      { time: 100, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 160, open: 11, high: 13, low: 10, close: 12, volume: 1 },
    ],
    [
      { time: 160, open: 11, high: 13, low: 10, close: 12, volume: 1 },
      { time: 220, open: 12, high: 14, low: 11, close: 13, volume: 1 },
      { time: 280, open: 14, high: 15, low: 12, close: 13, volume: 1 },
    ],
    [
      { time: 160, open: 11, high: 13, low: 10, close: 12, volume: 1 },
      { time: 220, open: 12, high: 14, low: 11, close: 13, volume: 1 },
      { time: 280, open: 14, high: 15, low: 12, close: 13, volume: 1 },
    ],
  ];
  let fetchIndex = 0;
  const sentMessages = [];
  const options = {
    now: '1970-01-01T00:06:00.000Z',
    strategies: [strategy],
    candleProvider: async () => candleSets[Math.min(fetchIndex++, candleSets.length - 1)],
    telegramFetch: async (_url, init) => {
      sentMessages.push(JSON.parse(init.body).text);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: sentMessages.length } }) };
    },
  };

  const seed = await runTelegramSignalMonitorOnce(repository, options);
  const realtime = await runTelegramSignalMonitorOnce(repository, options);
  const duplicate = await runTelegramSignalMonitorOnce(repository, options);

  assert.equal(seed.seededCount, 1);
  assert.equal(seed.sentCount, 0);
  assert.equal(realtime.sentCount, 1);
  assert.equal(duplicate.sentCount, 0);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /BUY .*BTCUSDT/);
  assert.match(sentMessages[0], /TF: 1m/);
});

test('server Telegram monitor scans closed candles since the last check so delayed cron runs do not skip signals', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const strategy = buildStrategyDefinition({
    id: 'strategy_test_delayed_cron_signal',
    name: 'Delayed Cron Signal Test',
    description: 'Signals only on the middle closed candle',
    language: 'javascript',
    sourceCode: `(
      function(_context, index) {
        return index === 1 ? 1 : 0;
      }
    )`,
  });
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_delayed_cron',
    strategyIds: [strategy.id],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));
  await repository.saveTelegramSignalWatchState({
    key: `${strategy.id}:BTCUSDT:1m`,
    strategyId: strategy.id,
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 60,
    lastSignalCandleTime: null,
    lastSignalEventType: null,
    updatedAt: '1970-01-01T00:01:00.000Z',
  });

  const sentMessages = [];
  const result = await runTelegramSignalMonitorOnce(repository, {
    now: '1970-01-01T00:21:30.000Z',
    strategies: [strategy],
    candleProvider: async () => Array.from({ length: 21 }, (_, index) => {
      const time = (index + 1) * 60;
      return { time, open: 10, high: 12, low: 9, close: index === 1 ? 11 : 10, volume: 1 };
    }),
    telegramFetch: async (_url, init) => {
      sentMessages.push(JSON.parse(init.body).text);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: sentMessages.length } }) };
    },
  });

  const watchState = await repository.getTelegramSignalWatchState(`${strategy.id}:BTCUSDT:1m`);

  assert.equal(result.sentCount, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /BUY .*BTCUSDT/);
  assert.match(sentMessages[0], /Time: 70\.01\.01 09:02:00 KST/);
  assert.equal(watchState?.lastCheckedCandleTime, 1200);
  assert.equal(watchState?.lastSignalCandleTime, 120);
  assert.equal(watchState?.lastSignalEventType, 'buy');
});

test('server Telegram monitor uses hybrid candle provider for Binance and gateway symbols by default', () => {
  const monitorSource = fs.readFileSync(new URL('../src/server/chart-service/telegram-signal-monitor.ts', import.meta.url), 'utf8');
  const candleSource = fs.readFileSync(new URL('../src/server/chart-service/server-candles.ts', import.meta.url), 'utf8');

  assert.match(monitorSource, /createHybridServerCandleProvider/);
  assert.match(monitorSource, /options\.candleProvider \?\? createHybridServerCandleProvider\(\)/);
  assert.match(candleSource, /shouldUseBinanceDirect\(args\.symbol\)/);
  assert.match(candleSource, /createMarketCandleServerProvider/);
  assert.match(candleSource, /selectMarketCandles/);
  assert.match(candleSource, /inferGatewayReportMarket\(symbol\)/);
});

test('server Telegram monitor applies stored strategy parameter profiles before computing signals', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const strategy = buildStrategyDefinition({
    id: 'strategy_test_param_gated_signal',
    name: 'Param Gated Signal Test',
    description: 'Signals only when the server parameter profile enables it',
    language: 'javascript',
    params: { fireSignal: false },
    sourceCode: `(
      function(context, index) {
        return context.__strategyParams.fireSignal === true && index === 1 ? 1 : 0;
      }
    )`,
  });
  await repository.saveSignalAdminSettings({
    id: 'default',
    hiddenSymbols: [],
    disabledSymbols: [],
    hiddenStrategyIds: [],
    signalPolicy: DEFAULT_SIGNAL_POLICY_SETTINGS,
    strategyParams: {
      profiles: [
        {
          id: `${strategy.id}:BTCUSDT`,
          strategyId: strategy.id,
          symbolId: 'BTCUSDT',
          name: 'BTCUSDT param gate',
          params: { fireSignal: true },
          enabled: true,
        },
      ],
    },
    strategyMgmtVisible: false,
    selectedStrategyId: strategy.id,
    updatedAt: now,
  });
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_param_gated',
    strategyIds: [strategy.id],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));
  await repository.saveTelegramSignalWatchState({
    key: `${strategy.id}:BTCUSDT:1m`,
    strategyId: strategy.id,
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 60,
    lastSignalCandleTime: null,
    lastSignalEventType: null,
    updatedAt: '1970-01-01T00:01:00.000Z',
  });

  const sentMessages = [];
  const result = await runTelegramSignalMonitorOnce(repository, {
    now: '1970-01-01T00:04:30.000Z',
    strategies: [strategy],
    candleProvider: async () => [
      { time: 60, open: 10, high: 11, low: 9, close: 10, volume: 1 },
      { time: 120, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 180, open: 11, high: 12, low: 10, close: 10, volume: 1 },
      { time: 240, open: 10, high: 13, low: 9, close: 12, volume: 1 },
    ],
    telegramFetch: async (_url, init) => {
      sentMessages.push(JSON.parse(init.body).text);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: sentMessages.length } }) };
    },
  });

  assert.equal(result.sentCount, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /BUY .*BTCUSDT/);
});

test('server Telegram monitor ignores still-open candles', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const strategy = buildStrategyDefinition({
    id: 'strategy_test_always_buy',
    name: 'Always Buy Test',
    description: 'Signals every candle',
    language: 'javascript',
    sourceCode: '(function() { return 1; })',
  });
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_open_candle',
    strategyIds: [strategy.id],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));
  await repository.saveTelegramSignalWatchState({
    key: `${strategy.id}:BTCUSDT:1m`,
    strategyId: strategy.id,
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 220,
    lastSignalCandleTime: 220,
    lastSignalEventType: 'buy',
    updatedAt: '1970-01-01T00:04:00.000Z',
  });

  const result = await runTelegramSignalMonitorOnce(repository, {
    now: '1970-01-01T00:05:10.000Z',
    strategies: [strategy],
    candleProvider: async () => [
      { time: 220, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 280, open: 11, high: 13, low: 10, close: 12, volume: 1 },
      { time: 340, open: 12, high: 14, low: 11, close: 13, volume: 1 },
    ],
    telegramFetch: async () => {
      throw new Error('open candle should not be sent');
    },
  });

  assert.equal(result.sentCount, 0);
  assert.equal(result.skippedOpenCandleCount, 1);
});

test('browser Telegram signal API shares watch state to suppress server monitor duplicates', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_shared_state',
    strategyIds: ['strategy_js_grid_martingale'],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));
  await repository.saveTelegramSignalWatchState({
    key: 'strategy_js_grid_martingale:BTCUSDT:1m',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 60,
    lastSignalCandleTime: 60,
    lastSignalEventType: 'buy',
    updatedAt: '1970-01-01T00:01:00.000Z',
  });

  const result = await sendAsyncTelegramAlertForSignalWithWatchState(repository, {
    eventType: 'buy',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 100,
    occurredAt: '1970-01-01T00:01:00.000Z',
  }, async () => {
    throw new Error('duplicate signal should not reach Telegram');
  });

  assert.equal(result.suppressedCount, 1);
  assert.equal(result.sentCount, 0);
  assert.equal(syncRepository.listTelegramDeliveryLogs().length, 0);
});

test('browser Telegram signal API allows delayed confirmations on earlier candles when the signal is new', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  await repository.saveTelegramBotProfile(createProfile({
    id: 'telegram_profile_delayed_browser_confirmation',
    strategyIds: ['strategy_js_grid_martingale'],
    symbolIds: ['BTCUSDT'],
    timeframeIds: ['1m'],
  }));
  await repository.saveTelegramSignalWatchState({
    key: 'strategy_js_grid_martingale:BTCUSDT:1m',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 300,
    lastSignalCandleTime: 60,
    lastSignalEventType: 'buy',
    updatedAt: '1970-01-01T00:05:00.000Z',
  });

  const sentMessages = [];
  const result = await sendAsyncTelegramAlertForSignalWithWatchState(repository, {
    eventType: 'sell',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 99,
    occurredAt: '1970-01-01T00:04:00.000Z',
  }, async (_url, init) => {
    sentMessages.push(JSON.parse(init.body).text);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: sentMessages.length } }) };
  });

  const watchState = await repository.getTelegramSignalWatchState('strategy_js_grid_martingale:BTCUSDT:1m');

  assert.equal(result.suppressedCount, 0);
  assert.equal(result.sentCount, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /SELL .*BTCUSDT/);
  assert.equal(watchState?.lastCheckedCandleTime, 300);
  assert.equal(watchState?.lastSignalCandleTime, 240);
  assert.equal(watchState?.lastSignalEventType, 'sell');
});

test('Cloudflare deploy config enables Telegram monitor catch-up cron', async () => {
  const wranglerConfig = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const customWorker = fs.readFileSync(new URL('../cloudflare-worker.ts', import.meta.url), 'utf8');
  const scheduledSource = fs.readFileSync(new URL('../src/server/chart-service/cloudflare-scheduled.ts', import.meta.url), 'utf8');

  assert.match(wranglerConfig, /"main"\s*:\s*"\.\/cloudflare-worker\.ts"/);
  assert.match(wranglerConfig, /CHART_SERVICE_TELEGRAM_CRON_ENABLED"\s*:\s*"true"/);
  assert.match(wranglerConfig, /^\s*"triggers"\s*:/m);
  assert.match(wranglerConfig, /^\s*"crons"\s*:\s*\[\s*"\* \* \* \* \*"/m);
  assert.match(customWorker, /from '\.\/\.open-next\/worker\.js'/);
  assert.match(customWorker, /scheduled/);
  assert.match(customWorker, /runScheduledTelegramSignalMonitor/);
  assert.match(scheduledSource, /isTelegramSignalCronEnabled/);

  const { runScheduledTelegramSignalMonitor } = await import('../src/server/chart-service/cloudflare-scheduled.ts');
  const result = await runScheduledTelegramSignalMonitor({
    CHART_SERVICE_REPOSITORY: 'memory',
    CHART_SERVICE_TELEGRAM_CRON_ENABLED: 'true',
  });

  assert.equal(result.disabled, undefined);
  assert.equal(result.jobCount, 0);
  assert.equal(result.sentCount, 0);
});

test('admin Telegram panel supports profile management and test sends without exposing raw saved tokens', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-telegram-alerts-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /maskedBotToken/);
  assert.match(panelSource, /sendTestMessage/);
  assert.match(panelSource, /eventTypes/);
  assert.match(panelSource, /timeframeIds: form\.timeframeIds/);
  assert.match(panelSource, /loadStrategies/);
  assert.match(panelSource, /getAllSymbolCatalog/);
  assert.match(panelSource, /TELEGRAM_TIMEFRAME_OPTIONS/);
  assert.match(panelSource, /FilterDropdown/);
  assert.match(panelSource, /admin-telegram-alerts-filter-dropdown/);
  assert.match(panelSource, /toggleFilterValue/);
  assert.match(panelSource, /type TelegramAlertsTab = 'profiles' \| 'logs'/);
  assert.match(panelSource, /const \[activeTab, setActiveTab\]/);
  assert.match(panelSource, /const \[profileViewMode, setProfileViewMode\]/);
  assert.match(panelSource, /봇프로필관리/);
  assert.match(panelSource, /전송로그/);
  assert.match(panelSource, /admin-telegram-alerts-test-send/);
  assert.match(panelSource, /admin-telegram-alerts-table-wrap/);
  assert.match(panelSource, /admin-telegram-alerts-profile-table/);
  assert.match(panelSource, /admin-telegram-alerts-log-table/);
  assert.doesNotMatch(panelSource, /profile\.botToken/);
});

test('chart signal Telegram API authenticates and dispatches normalized signal events', () => {
  const routeSource = fs.readFileSync(new URL('../app/api/telegram-alerts/signal/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /guardMutationRequest\(request, \{[\s\S]*?scope: 'telegram-signal-alert'/);
  assert.match(routeSource, /getActorFromAsyncRequest/);
  assert.match(routeSource, /TELEGRAM_SIGNAL_EVENT_TYPES/);
  assert.match(routeSource, /sendAsyncTelegramAlertForSignal/);
  assert.match(routeSource, /eventType/);
  assert.match(routeSource, /strategyId/);
  assert.match(routeSource, /symbolId/);
  assert.match(routeSource, /stopLossPrice/);
  assert.match(routeSource, /takeProfitPrices/);
});
