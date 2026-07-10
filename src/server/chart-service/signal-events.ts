import { SIGNAL_SOURCES, type SignalSource } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { SignalEventOrigin, SignalEventRecord } from './repository.ts';
import { publishSignalRealtimeEvent } from './signal-realtime.ts';
import type { TelegramSignalEvent } from './telegram-alerts.ts';

export async function saveAsyncSignalEventFromTelegramEvent(
  repository: AsyncChartServiceRepository,
  event: TelegramSignalEvent,
  options: {
    origin: SignalEventOrigin;
    now?: string;
  },
): Promise<SignalEventRecord> {
  const now = normalizeIso(options.now) ?? new Date().toISOString();
  const record = createSignalEventRecordFromTelegramEvent(await repository.nextId('signal_event'), event, {
    origin: options.origin,
    now,
  });
  await repository.saveSignalEvent(record);
  publishSignalRealtimeEvent(record);
  return record;
}

export type SignalEventClaimResult = {
  record: SignalEventRecord;
  claimed: boolean;
};

export async function claimAsyncSignalEventFromTelegramEvent(
  repository: AsyncChartServiceRepository,
  event: TelegramSignalEvent,
  options: {
    origin: SignalEventOrigin;
    now?: string;
  },
): Promise<SignalEventClaimResult> {
  const now = normalizeIso(options.now) ?? new Date().toISOString();
  const record = createSignalEventRecordFromTelegramEvent(
    createSignalEventDedupeId(event, now),
    event,
    { origin: options.origin, now },
  );
  const claimed = await repository.createSignalEventIfAbsent(record);
  if (claimed) publishSignalRealtimeEvent(record);
  return { record, claimed };
}

export function createSignalEventDedupeId(event: TelegramSignalEvent, fallbackNow: string): string {
  const occurredAt = normalizeIso(event.occurredAt) ?? fallbackNow;
  const components = [
    event.eventType,
    event.strategyId.trim(),
    event.symbolId.trim().toUpperCase(),
    normalizeSignalTimeframe(event.timeframe),
    occurredAt,
  ];
  return `signal_event_once_${components.map((value) => encodeURIComponent(value)).join('|')}`;
}

export function createSignalEventRecordFromTelegramEvent(
  id: string,
  event: TelegramSignalEvent,
  options: {
    origin: SignalEventOrigin;
    now: string;
  },
): SignalEventRecord {
  return {
    id,
    eventType: event.eventType,
    source: normalizeSignalSource(event.signalSource),
    origin: options.origin,
    strategyId: event.strategyId.trim(),
    strategyName: normalizeNullableText(event.strategyName),
    symbolId: event.symbolId.trim().toUpperCase(),
    timeframe: normalizeNullableText(event.timeframe),
    price: normalizeNullableNumber(event.price),
    stopLossPrice: normalizeNullableNumber(event.stopLossPrice),
    takeProfitPrices: normalizeTakeProfitPrices(event.takeProfitPrices),
    executionMode: normalizeNullableText(event.executionMode),
    fillModel: normalizeNullableText(event.fillModel),
    occurredAt: normalizeIso(event.occurredAt) ?? options.now,
    createdAt: options.now,
  };
}

function normalizeSignalSource(value: unknown): SignalSource {
  const source = typeof value === 'string' ? value.trim() : '';
  return SIGNAL_SOURCES.includes(source as SignalSource) ? source as SignalSource : 'chart_strategy';
}

function normalizeNullableText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function normalizeSignalTimeframe(value: unknown): string {
  const timeframe = normalizeNullableText(value) ?? '';
  return timeframe === '1M' ? timeframe : timeframe.toLowerCase();
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTakeProfitPrices(values: number[] | undefined): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function normalizeIso(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
