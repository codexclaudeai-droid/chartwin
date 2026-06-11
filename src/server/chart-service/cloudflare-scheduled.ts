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

export async function runScheduledTelegramSignalMonitor(
  env: ChartServiceRepositoryRuntimeEnv,
  controller: ScheduledControllerLike = {},
): Promise<TelegramSignalMonitorResult> {
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
    scope: 'telegram-signal-monitor',
    cron: controller.cron ?? null,
    ...result,
  }));
}
