import assert from 'node:assert/strict';
import test from 'node:test';

import { createPostgresAsyncChartServiceRepository } from '../src/server/chart-service/index.ts';

test('postgres signal claim is atomic and watch state upsert is monotonic', async () => {
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (/on conflict \(id\) do nothing returning id/i.test(statement.sql)) {
        return { rows: [{ id: 'signal_event_dedupe' }] };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);
  const claimed = await repository.createSignalEventIfAbsent({
    id: 'signal_event_dedupe',
    eventType: 'buy',
    source: 'chart_strategy',
    origin: 'browser_chart',
    strategyId: 'strategy_js_grid_martingale',
    strategyName: null,
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    price: 100,
    stopLossPrice: null,
    takeProfitPrices: [],
    executionMode: null,
    fillModel: null,
    occurredAt: '2026-07-11T01:00:00.000Z',
    createdAt: '2026-07-11T01:01:00.000Z',
  });
  await repository.saveTelegramSignalWatchState({
    key: 'strategy_js_grid_martingale:BTCUSDT:1m',
    strategyId: 'strategy_js_grid_martingale',
    symbolId: 'BTCUSDT',
    timeframe: '1m',
    lastCheckedCandleTime: 600,
    lastSignalCandleTime: 540,
    lastSignalEventType: 'sell',
    updatedAt: '2026-07-11T01:10:00.000Z',
  });

  const claimSql = calls.find((call) => /insert into signal_events/i.test(call.sql))?.sql ?? '';
  const watchSql = calls.find((call) => /insert into telegram_signal_watch_states/i.test(call.sql))?.sql ?? '';
  assert.equal(claimed, true);
  assert.match(claimSql, /on conflict \(id\) do nothing returning id/i);
  assert.match(
    watchSql,
    /greatest\(telegram_signal_watch_states\.last_checked_candle_time, excluded\.last_checked_candle_time\)/i,
  );
  assert.match(
    watchSql,
    /excluded\.last_signal_candle_time >= telegram_signal_watch_states\.last_signal_candle_time/i,
  );
});
