import { runNodeTelegramSignalMonitor } from '../src/server/chart-service/telegram-signal-monitor-runner.ts';

const abortController = new AbortController();

process.once('SIGINT', () => {
  abortController.abort();
});

process.once('SIGTERM', () => {
  abortController.abort();
});

try {
  await runNodeTelegramSignalMonitor({
    env: process.env,
    signal: abortController.signal,
    logger: console,
  });
} catch (error) {
  console.error(JSON.stringify({
    scope: 'node-telegram-signal-monitor-fatal',
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
}
