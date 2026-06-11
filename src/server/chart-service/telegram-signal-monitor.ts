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
      const closed = getLatestClosedSignal({
        candles,
        signals: computeServerStrategySignals({ strategy, candles, symbol: job.symbolId }),
        timeframe: job.timeframe,
        nowSec,
      });
      if (!closed) {
        continue;
      }

      const eventType = signalToTelegramEventType(closed.signal);
      const previous = await repository.getTelegramSignalWatchState(job.key);
      const nextState = createTelegramSignalWatchState(job, closed.candle.time, eventType, nowIso);

      if (!previous) {
        await repository.saveTelegramSignalWatchState(nextState);
        result.seededCount += 1;
        continue;
      }

      if (closed.candle.time <= previous.lastCheckedCandleTime || !eventType) {
        await repository.saveTelegramSignalWatchState(nextState);
        continue;
      }

      const delivery = await sendAsyncTelegramAlertForSignal(repository, {
        eventType,
        strategyId: job.strategyId,
        strategyName: strategy.name,
        symbolId: job.symbolId,
        timeframe: job.timeframe,
        price: closed.candle.close,
        occurredAt: new Date(closed.candle.time * 1000).toISOString(),
      }, options.telegramFetch);
      result.sentCount += delivery.sentCount;
      result.failedCount += delivery.failedCount;
      await repository.saveTelegramSignalWatchState(nextState);
    } catch (error) {
      result.skippedCount += 1;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return result;
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
    createTelegramSignalWatchState(job, eventCandleTime, event.eventType, new Date().toISOString()),
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

function hasOpenTailCandle(candles: ServerStrategyCandle[], timeframe: TimeframeKey, nowSec: number): boolean {
  const timeframeSec = TIMEFRAME_SECONDS[timeframe];
  const last = candles[candles.length - 1];
  return Boolean(last && timeframeSec && last.time + timeframeSec > nowSec);
}

function createTelegramSignalWatchState(
  job: TelegramSignalMonitorJob,
  candleTime: number,
  eventType: TelegramSignalEventType | null,
  updatedAt: string,
): TelegramSignalWatchStateRecord {
  return {
    key: job.key,
    strategyId: job.strategyId,
    symbolId: job.symbolId,
    timeframe: job.timeframe,
    lastCheckedCandleTime: candleTime,
    lastSignalCandleTime: eventType ? candleTime : null,
    lastSignalEventType: eventType,
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
