import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createMockChartServiceRepository,
  createAsyncChartServiceRepository,
  createPostgresAsyncChartServiceRepository,
  formatTelegramSignalMessage,
  getEnabledTelegramProfilesForSignal,
  maskTelegramBotToken,
  sendAsyncTelegramAlertForSignal,
  sendTelegramAlertForSignal,
  toPublicTelegramBotProfile,
} from '../src/server/chart-service/index.ts';

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

  assert.match(message, /BUY BTCUSDT/);
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
  }), /^S\/L BTCUSDT/);
  assert.match(formatTelegramSignalMessage({
    eventType: 'take_profit',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    occurredAt: now,
  }), /^T\/P BTCUSDT/);
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
