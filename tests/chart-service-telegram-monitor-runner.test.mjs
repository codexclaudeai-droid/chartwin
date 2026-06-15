import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getNextTelegramSignalMonitorDelayMs,
  resolveNodeTelegramSignalMonitorConfig,
  runTelegramSignalMonitorLoop,
} from '../src/server/chart-service/telegram-signal-monitor-runner.ts';

test('Node Telegram monitor runner is independent from paused Cloudflare cron', () => {
  const config = resolveNodeTelegramSignalMonitorConfig({
    CHART_SERVICE_TELEGRAM_CRON_ENABLED: 'false',
  });

  assert.equal(config.enabled, true);
  assert.equal(config.intervalMs, 60_000);
  assert.equal(config.settleDelayMs, 3_000);
  assert.equal(config.candleLimit, 500);

  assert.equal(resolveNodeTelegramSignalMonitorConfig({
    CHART_SERVICE_SIGNAL_MONITOR_ENABLED: 'false',
  }).enabled, false);
});

test('Node Telegram monitor delay aligns checks just after candle close', () => {
  assert.equal(getNextTelegramSignalMonitorDelayMs({
    nowMs: Date.parse('2026-06-15T00:00:58.000Z'),
    intervalMs: 60_000,
    settleDelayMs: 3_000,
  }), 5_000);

  assert.equal(getNextTelegramSignalMonitorDelayMs({
    nowMs: Date.parse('2026-06-15T00:01:01.000Z'),
    intervalMs: 60_000,
    settleDelayMs: 3_000,
  }), 2_000);

  assert.equal(getNextTelegramSignalMonitorDelayMs({
    nowMs: Date.parse('2026-06-15T00:01:04.000Z'),
    intervalMs: 60_000,
    settleDelayMs: 3_000,
  }), 59_000);
});

test('Node Telegram monitor loop runs once per aligned cycle and can stop after a bounded run', async () => {
  const runs = [];
  const delays = [];

  const result = await runTelegramSignalMonitorLoop({
    maxIterations: 2,
    nowMs: () => Date.parse('2026-06-15T00:00:58.000Z'),
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
    runOnce: async (now) => {
      runs.push(now.toISOString());
      return {
        jobCount: 1,
        sentCount: runs.length,
        failedCount: 0,
        seededCount: 0,
        skippedCount: 0,
        skippedOpenCandleCount: 0,
        errors: [],
      };
    },
  });

  assert.deepEqual(runs, [
    '2026-06-15T00:00:58.000Z',
    '2026-06-15T00:00:58.000Z',
  ]);
  assert.deepEqual(delays, [5_000]);
  assert.equal(result.iterations, 2);
  assert.equal(result.lastResult?.sentCount, 2);
});

test('package exposes a Node Telegram monitor command for AWS process managers', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const scriptSource = fs.readFileSync(
    new URL('../scripts/run-telegram-signal-monitor.mjs', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.scripts['service:telegram-monitor'], 'node scripts/run-telegram-signal-monitor.mjs');
  assert.match(scriptSource, /runNodeTelegramSignalMonitor/);
  assert.match(scriptSource, /SIGTERM/);
  assert.match(scriptSource, /SIGINT/);
});
