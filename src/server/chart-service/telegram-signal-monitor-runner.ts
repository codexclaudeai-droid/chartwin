import { getAsyncChartServicePersistence } from './singleton.ts';
import {
  DEFAULT_SERVER_SIGNAL_CANDLE_LIMIT,
  runTelegramSignalMonitorOnce,
  type TelegramSignalMonitorResult,
} from './telegram-signal-monitor.ts';
import type { ChartServiceRepositoryRuntimeEnv } from './repository-adapter.ts';

export type NodeTelegramSignalMonitorEnv = ChartServiceRepositoryRuntimeEnv & {
  CHART_SERVICE_SIGNAL_MONITOR_ENABLED?: string;
  CHART_SERVICE_SIGNAL_MONITOR_INTERVAL_MS?: string;
  CHART_SERVICE_SIGNAL_MONITOR_SETTLE_DELAY_MS?: string;
  CHART_SERVICE_SIGNAL_MONITOR_CANDLE_LIMIT?: string;
};

export type NodeTelegramSignalMonitorConfig = {
  enabled: boolean;
  intervalMs: number;
  settleDelayMs: number;
  candleLimit: number;
};

export type TelegramSignalMonitorLoopResult = {
  iterations: number;
  lastResult: TelegramSignalMonitorResult | null;
};

export type TelegramSignalMonitorLoopOptions = {
  runOnce: (now: Date) => Promise<TelegramSignalMonitorResult>;
  intervalMs?: number;
  settleDelayMs?: number;
  maxIterations?: number;
  signal?: AbortSignal;
  nowMs?: () => number;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  logger?: Pick<Console, 'log' | 'error'>;
};

export type RunNodeTelegramSignalMonitorOptions = {
  env?: NodeTelegramSignalMonitorEnv;
  signal?: AbortSignal;
  maxIterations?: number;
  logger?: Pick<Console, 'log' | 'error'>;
};

const DEFAULT_MONITOR_INTERVAL_MS = 60_000;
const DEFAULT_MONITOR_SETTLE_DELAY_MS = 3_000;
const DEFAULT_MONITOR_CANDLE_LIMIT = DEFAULT_SERVER_SIGNAL_CANDLE_LIMIT;

export function resolveNodeTelegramSignalMonitorConfig(
  env: NodeTelegramSignalMonitorEnv = {},
): NodeTelegramSignalMonitorConfig {
  return {
    enabled: normalizeEnabledFlag(env.CHART_SERVICE_SIGNAL_MONITOR_ENABLED),
    intervalMs: normalizePositiveInteger(
      env.CHART_SERVICE_SIGNAL_MONITOR_INTERVAL_MS,
      DEFAULT_MONITOR_INTERVAL_MS,
    ),
    settleDelayMs: normalizeNonNegativeInteger(
      env.CHART_SERVICE_SIGNAL_MONITOR_SETTLE_DELAY_MS,
      DEFAULT_MONITOR_SETTLE_DELAY_MS,
    ),
    candleLimit: normalizePositiveInteger(
      env.CHART_SERVICE_SIGNAL_MONITOR_CANDLE_LIMIT,
      DEFAULT_MONITOR_CANDLE_LIMIT,
    ),
  };
}

export function getNextTelegramSignalMonitorDelayMs(args: {
  nowMs: number;
  intervalMs: number;
  settleDelayMs: number;
}): number {
  const intervalMs = Math.max(1, Math.floor(args.intervalMs));
  const settleDelayMs = Math.max(0, Math.floor(args.settleDelayMs));
  const nowMs = Math.max(0, Math.floor(args.nowMs));
  const currentSlotStartMs = nowMs - (nowMs % intervalMs);
  const currentSettledMs = currentSlotStartMs + settleDelayMs;
  const nextSettledMs = currentSlotStartMs + intervalMs + settleDelayMs;
  const targetMs = nowMs < currentSettledMs ? currentSettledMs : nextSettledMs;
  return Math.max(0, targetMs - nowMs);
}

export async function runTelegramSignalMonitorLoop(
  options: TelegramSignalMonitorLoopOptions,
): Promise<TelegramSignalMonitorLoopResult> {
  const intervalMs = options.intervalMs ?? DEFAULT_MONITOR_INTERVAL_MS;
  const settleDelayMs = options.settleDelayMs ?? DEFAULT_MONITOR_SETTLE_DELAY_MS;
  const nowMs = options.nowMs ?? (() => Date.now());
  const sleep = options.sleep ?? sleepWithAbort;
  let iterations = 0;
  let lastResult: TelegramSignalMonitorResult | null = null;

  while (!options.signal?.aborted) {
    const runStartedAt = new Date(nowMs());

    try {
      lastResult = await options.runOnce(runStartedAt);
      options.logger?.log(JSON.stringify({
        scope: 'node-telegram-signal-monitor',
        runStartedAt: runStartedAt.toISOString(),
        ...lastResult,
      }));
    } catch (error) {
      options.logger?.error(JSON.stringify({
        scope: 'node-telegram-signal-monitor-error',
        runStartedAt: runStartedAt.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
    }

    iterations += 1;
    if (options.maxIterations && iterations >= options.maxIterations) break;
    if (options.signal?.aborted) break;

    const delayMs = getNextTelegramSignalMonitorDelayMs({
      nowMs: nowMs(),
      intervalMs,
      settleDelayMs,
    });
    await sleep(delayMs, options.signal);
  }

  return { iterations, lastResult };
}

export async function runNodeTelegramSignalMonitor(
  options: RunNodeTelegramSignalMonitorOptions = {},
): Promise<TelegramSignalMonitorLoopResult> {
  const env = options.env ?? readProcessEnv();
  const config = resolveNodeTelegramSignalMonitorConfig(env);
  const logger = options.logger ?? console;

  if (!config.enabled) {
    logger.log(JSON.stringify({
      scope: 'node-telegram-signal-monitor-disabled',
      reason: 'CHART_SERVICE_SIGNAL_MONITOR_ENABLED=false',
    }));
    return { iterations: 0, lastResult: null };
  }

  const persistence = getAsyncChartServicePersistence(env);
  return await runTelegramSignalMonitorLoop({
    intervalMs: config.intervalMs,
    settleDelayMs: config.settleDelayMs,
    maxIterations: options.maxIterations,
    signal: options.signal,
    logger,
    runOnce: async (now) => await persistence.runMutation(async (repository) => (
      await runTelegramSignalMonitorOnce(repository, {
        now,
        candleLimit: config.candleLimit,
      })
    )),
  });
}

function normalizeEnabledFlag(value: string | undefined): boolean {
  return String(value ?? 'true').trim().toLowerCase() !== 'false';
}

function normalizePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.floor(parsed);
  return integer > 0 ? integer : fallback;
}

function normalizeNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.floor(parsed);
  return integer >= 0 ? integer : fallback;
}

async function sleepWithAbort(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0 || signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function readProcessEnv(): NodeTelegramSignalMonitorEnv {
  return ((globalThis as typeof globalThis & {
    process?: { env?: NodeTelegramSignalMonitorEnv };
  }).process?.env) ?? {};
}
