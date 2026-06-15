import { TIMEFRAME_SECONDS, type TimeframeKey } from '../../catalog/time.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { StrategyDefinition, StrategySignal } from '../../strategy/strategy-service.ts';
import type {
  TelegramBotProfileRecord,
  TelegramSignalEventType,
  TelegramSignalWatchStateRecord,
} from './repository.ts';
import {
  TELEGRAM_SIGNAL_EVENT_TYPES,
  sendAsyncTelegramAlertForSignal,
  type TelegramFetch,
  type TelegramSignalEvent,
} from './telegram-alerts.ts';
import {
  computeServerStrategySignals,
  findServerStrategyById,
  getDefaultServerStrategies,
  isSupportedServerTimeframe,
  type ServerStrategyCandle,
} from './server-strategy-signals.ts';
import {
  createBinanceServerCandleProvider,
  type ServerCandleProvider,
} from './server-candles.ts';
import { notifyAsyncSignalPushSubscribers } from './signal-push-notifications.ts';

export type TelegramSignalMonitorJob = {
  key: string;
  strategyId: string;
  symbolId: string;
  timeframe: TimeframeKey;
};

export type TelegramSignalMonitorResult = {
  jobCount: number;
  sentCount: number;
  failedCount: number;
  seededCount: number;
  skippedCount: number;
  skippedOpenCandleCount: number;
  pushEligibleUserCount: number;
  pushNotificationCount: number;
  pushAttemptedCount: number;
  pushDeliveredCount: number;
  pushRemovedCount: number;
  pushFailedCount: number;
  errors: string[];
};

export type TelegramSignalDeliveryResult = Awaited<ReturnType<typeof sendAsyncTelegramAlertForSignal>> & {
  suppressedCount: number;
};

export type TelegramSignalMonitorOptions = {
  now?: string | Date;
  strategies?: StrategyDefinition[];
  candleProvider?: ServerCandleProvider;
  telegramFetch?: TelegramFetch;
  candleLimit?: number;
};

const DEFAULT_CANDLE_LIMIT = 500;
const MAX_REALTIME_CATCHUP_BARS = 10;

export async function runTelegramSignalMonitorOnce(
  repository: AsyncChartServiceRepository,
  options: TelegramSignalMonitorOptions = {},
): Promise<TelegramSignalMonitorResult> {
  const nowDate = normalizeNow(options.now);
  const nowIso = nowDate.toISOString();
  const nowSec = Math.floor(nowDate.getTime() / 1000);
  const strategies = options.strategies ?? getDefaultServerStrategies();
  const candleProvider = options.candleProvider ?? createBinanceServerCandleProvider();
  const jobs = buildTelegramSignalMonitorJobs(await repository.listTelegramBotProfiles());
  const result: TelegramSignalMonitorResult = {
    jobCount: jobs.length,
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

  for (const job of jobs) {
    try {
      const strategy = findServerStrategyById(job.strategyId, strategies);
      if (!strategy) {
        result.skippedCount += 1;
        result.errors.push(`strategy not found: ${job.strategyId}`);
        continue;
      }

      const candles = await candleProvider({
        symbol: job.symbolId,
        timeframe: job.timeframe,
        limit: options.candleLimit ?? DEFAULT_CANDLE_LIMIT,
      });
      if (hasOpenTailCandle(candles, job.timeframe, nowSec)) {
        result.skippedOpenCandleCount += 1;
      }
      const signals = computeServerStrategySignals({ strategy, candles, symbol: job.symbolId });
      const closed = getLatestClosedSignal({
        candles,
        signals,
        timeframe: job.timeframe,
        nowSec,
      });
      if (!closed) {
        continue;
      }

      const eventType = signalToTelegramEventType(closed.signal);
      const previous = await repository.getTelegramSignalWatchState(job.key);

      if (!previous) {
        await repository.saveTelegramSignalWatchState(createTelegramSignalWatchState(
          job,
          closed.candle.time,
          eventType ? closed.candle.time : null,
          eventType,
          nowIso,
        ));
        result.seededCount += 1;
        continue;
      }

      if (closed.candle.time <= previous.lastCheckedCandleTime) {
        continue;
      }

      const closedSignals = getClosedSignalEventsAfter({
        candles,
        signals,
        timeframe: job.timeframe,
        nowSec,
        afterCandleTime: previous.lastCheckedCandleTime,
        latestClosedCandleTime: closed.candle.time,
      });
      let lastSignalCandleTime = previous.lastSignalCandleTime;
      let lastSignalEventType = previous.lastSignalEventType;

      if (!closedSignals.length) {
        await repository.saveTelegramSignalWatchState(createTelegramSignalWatchState(
          job,
          closed.candle.time,
          lastSignalCandleTime,
          lastSignalEventType,
          nowIso,
        ));
        continue;
      }

      for (const closedSignal of closedSignals) {
        const event = {
          eventType: closedSignal.eventType,
          strategyId: job.strategyId,
          strategyName: strategy.name,
          symbolId: job.symbolId,
          timeframe: job.timeframe,
          price: closedSignal.candle.close,
          occurredAt: new Date(closedSignal.candle.time * 1000).toISOString(),
        };
        const delivery = await sendAsyncTelegramAlertForSignal(repository, event, options.telegramFetch);
        result.sentCount += delivery.sentCount;
        result.failedCount += delivery.failedCount;
        await notifySignalPushSubscribers(repository, event, result);
        lastSignalCandleTime = closedSignal.candle.time;
        lastSignalEventType = closedSignal.eventType;
      }

      await repository.saveTelegramSignalWatchState(createTelegramSignalWatchState(
        job,
        closed.candle.time,
        lastSignalCandleTime,
        lastSignalEventType,
        nowIso,
      ));
    } catch (error) {
      result.skippedCount += 1;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}

async function notifySignalPushSubscribers(
  repository: AsyncChartServiceRepository,
  event: Parameters<typeof notifyAsyncSignalPushSubscribers>[1],
  result: TelegramSignalMonitorResult,
): Promise<void> {
  try {
    const push = await notifyAsyncSignalPushSubscribers(repository, event);
    result.pushEligibleUserCount += push.eligibleUserCount;
    result.pushNotificationCount += push.notificationCount;
    result.pushAttemptedCount += push.pushAttemptedCount;
    result.pushDeliveredCount += push.pushDeliveredCount;
    result.pushRemovedCount += push.pushRemovedCount;
    result.pushFailedCount += push.pushFailedCount;
  } catch (error) {
    result.pushFailedCount += 1;
    result.errors.push(`signal push failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function buildTelegramSignalMonitorJobs(
  profiles: TelegramBotProfileRecord[],
): TelegramSignalMonitorJob[] {
  const jobs = new Map<string, TelegramSignalMonitorJob>();
  for (const profile of profiles) {
    if (!profile.isEnabled) continue;
    if (!profileWantsEntrySignals(profile)) continue;
    for (const strategyId of profile.strategyIds.map(normalizeString).filter(Boolean)) {
      for (const symbolId of profile.symbolIds.map(normalizeSymbol).filter(Boolean)) {
        for (const timeframe of profile.timeframeIds.map(normalizeString).filter(isSupportedServerTimeframe)) {
          const key = createTelegramSignalWatchKey(strategyId, symbolId, timeframe);
          jobs.set(key, { key, strategyId, symbolId, timeframe });
        }
      }
    }
  }
  return Array.from(jobs.values()).sort((left, right) => left.key.localeCompare(right.key));
}

export function createTelegramSignalWatchKey(strategyId: string, symbolId: string, timeframe: string): string {
  return `${normalizeString(strategyId)}:${normalizeSymbol(symbolId)}:${normalizeString(timeframe)}`;
}

export async function sendAsyncTelegramAlertForSignalWithWatchState(
  repository: AsyncChartServiceRepository,
  event: TelegramSignalEvent,
  fetcher?: TelegramFetch,
): Promise<TelegramSignalDeliveryResult> {
  const eventCandleTime = readEventCandleTimeSec(event);
  const timeframe = normalizeString(event.timeframe ?? '');
  const canTrack = eventCandleTime != null &&
    (event.eventType === 'buy' || event.eventType === 'sell') &&
    isSupportedServerTimeframe(timeframe);

  if (!canTrack) {
    const delivery = await sendAsyncTelegramAlertForSignal(repository, event, fetcher);
    return { ...delivery, suppressedCount: 0 };
  }

  const job: TelegramSignalMonitorJob = {
    key: createTelegramSignalWatchKey(event.strategyId, event.symbolId, timeframe),
    strategyId: normalizeString(event.strategyId),
    symbolId: normalizeSymbol(event.symbolId),
    timeframe,
  };
  const previous = await repository.getTelegramSignalWatchState(job.key);
  if (previous && eventCandleTime <= previous.lastCheckedCandleTime) {
    return { sentCount: 0, failedCount: 0, logs: [], suppressedCount: 1 };
  }

  const delivery = await sendAsyncTelegramAlertForSignal(repository, event, fetcher);
  await repository.saveTelegramSignalWatchState(
    createTelegramSignalWatchState(job, eventCandleTime, eventCandleTime, event.eventType, new Date().toISOString()),
  );
  return { ...delivery, suppressedCount: 0 };
}

function getLatestClosedSignal(args: {
  candles: ServerStrategyCandle[];
  signals: StrategySignal[];
  timeframe: TimeframeKey;
  nowSec: number;
}): { candle: ServerStrategyCandle; signal: StrategySignal } | null {
  const timeframeSec = TIMEFRAME_SECONDS[args.timeframe];
  if (!timeframeSec) return null;
  const count = Math.min(args.candles.length, args.signals.length);
  for (let index = count - 1; index >= 0; index -= 1) {
    const candle = args.candles[index];
    if (!candle) continue;
    if (candle.time + timeframeSec > args.nowSec) continue;
    return { candle, signal: args.signals[index] ?? 0 };
  }
  return null;
}

function getClosedSignalEventsAfter(args: {
  candles: ServerStrategyCandle[];
  signals: StrategySignal[];
  timeframe: TimeframeKey;
  nowSec: number;
  afterCandleTime: number;
  latestClosedCandleTime: number;
}): Array<{ candle: ServerStrategyCandle; signal: StrategySignal; eventType: TelegramSignalEventType }> {
  const timeframeSec = TIMEFRAME_SECONDS[args.timeframe];
  if (!timeframeSec) return [];
  const count = Math.min(args.candles.length, args.signals.length);
  const minCatchupTime = args.latestClosedCandleTime - timeframeSec * MAX_REALTIME_CATCHUP_BARS;
  const afterTime = Math.max(args.afterCandleTime, minCatchupTime);
  const events: Array<{ candle: ServerStrategyCandle; signal: StrategySignal; eventType: TelegramSignalEventType }> = [];

  for (let index = 0; index < count; index += 1) {
    const candle = args.candles[index];
    if (!candle) continue;
    if (candle.time <= afterTime) continue;
    if (candle.time + timeframeSec > args.nowSec) continue;
    const signal = args.signals[index] ?? 0;
    const eventType = signalToTelegramEventType(signal);
    if (!eventType) continue;
    events.push({ candle, signal, eventType });
  }

  return events;
}

function hasOpenTailCandle(candles: ServerStrategyCandle[], timeframe: TimeframeKey, nowSec: number): boolean {
  const timeframeSec = TIMEFRAME_SECONDS[timeframe];
  const last = candles[candles.length - 1];
  return Boolean(last && timeframeSec && last.time + timeframeSec > nowSec);
}

function createTelegramSignalWatchState(
  job: TelegramSignalMonitorJob,
  lastCheckedCandleTime: number,
  lastSignalCandleTime: number | null,
  lastSignalEventType: TelegramSignalEventType | null,
  updatedAt: string,
): TelegramSignalWatchStateRecord {
  return {
    key: job.key,
    strategyId: job.strategyId,
    symbolId: job.symbolId,
    timeframe: job.timeframe,
    lastCheckedCandleTime,
    lastSignalCandleTime,
    lastSignalEventType,
    updatedAt,
  };
}

function signalToTelegramEventType(signal: StrategySignal): TelegramSignalEventType | null {
  if (signal > 0) return 'buy';
  if (signal < 0) return 'sell';
  return null;
}

function profileWantsEntrySignals(profile: TelegramBotProfileRecord): boolean {
  return profile.eventTypes.length === 0 || profile.eventTypes.some((eventType) => (
    TELEGRAM_SIGNAL_EVENT_TYPES.includes(eventType) && (eventType === 'buy' || eventType === 'sell')
  ));
}

function normalizeNow(value: TelegramSignalMonitorOptions['now']): Date {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : new Date();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeString(value: string): string {
  return String(value || '').trim();
}

function normalizeSymbol(value: string): string {
  return normalizeString(value).toUpperCase();
}

function readEventCandleTimeSec(event: TelegramSignalEvent): number | null {
  const timestampMs = Date.parse(event.occurredAt);
  if (!Number.isFinite(timestampMs)) return null;
  return Math.floor(timestampMs / 1000);
}
