import { getAsyncChartServicePersistence } from './singleton.ts';
import {
  runTelegramSignalMonitorOnce,
  type TelegramSignalMonitorResult,
} from './telegram-signal-monitor.ts';
import type { ChartServiceRepositoryRuntimeEnv } from './repository-adapter.ts';

type ScheduledControllerLike = {
  cron?: string;
  scheduledTime?: number;
};

export type ScheduledTelegramSignalMonitorResult = TelegramSignalMonitorResult & {
  disabled?: boolean;
  reason?: string;
};

export async function runScheduledTelegramSignalMonitor(
  env: ChartServiceRepositoryRuntimeEnv,
  controller: ScheduledControllerLike = {},
): Promise<ScheduledTelegramSignalMonitorResult> {
  if (!isTelegramSignalCronEnabled(env)) {
    return createDisabledTelegramSignalMonitorResult('Cloudflare cron is paused; chart-page realtime alerts remain active.');
  }

  const scheduledAt = Number.isFinite(controller.scheduledTime)
    ? new Date(Number(controller.scheduledTime)).toISOString()
    : new Date().toISOString();
  const persistence = getAsyncChartServicePersistence(env);
  return await persistence.runMutation(async (repository) => (
    await runTelegramSignalMonitorOnce(repository, { now: scheduledAt })
  ));
}

export async function scheduled(
  controller: ScheduledControllerLike,
  env: ChartServiceRepositoryRuntimeEnv,
): Promise<void> {
  const result = await runScheduledTelegramSignalMonitor(env, controller);
  console.log(JSON.stringify({
    scope: result.disabled ? 'telegram-signal-monitor-disabled' : 'telegram-signal-monitor',
    cron: controller.cron ?? null,
    ...result,
  }));
}

function isTelegramSignalCronEnabled(env: ChartServiceRepositoryRuntimeEnv): boolean {
  return String(env.CHART_SERVICE_TELEGRAM_CRON_ENABLED || '').trim().toLowerCase() === 'true';
}

function createDisabledTelegramSignalMonitorResult(reason: string): ScheduledTelegramSignalMonitorResult {
  return {
    disabled: true,
    reason,
    jobCount: 0,
    sentCount: 0,
    failedCount: 0,
    seededCount: 0,
    skippedCount: 0,
    skippedOpenCandleCount: 0,
    pushEligibleUserCount: 0,
    pushNotificationCount: 0,
    pushAttemptedCount: 0,
    pushDeliveredCount: 0,
    pushRemovedCount: 0,
    pushFailedCount: 0,
    errors: [],
  };
}
