import { NextResponse, type NextRequest } from 'next/server.js';
import {
  TELEGRAM_SIGNAL_EVENT_TYPES,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
  sendAsyncTelegramAlertForSignalWithWatchState,
  type TelegramSignalEvent,
  type TelegramSignalEventType,
} from '../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request, {
    scope: 'telegram-signal-alert',
    windowMs: 10_000,
    limit: 60,
  });
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, message: 'invalid json' }, { status: 400 });
  }

  let event: TelegramSignalEvent;
  try {
    event = readTelegramSignalEvent(body);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'invalid Telegram signal payload',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation(async (repository) => {
      await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return await sendAsyncTelegramAlertForSignalWithWatchState(repository, event);
    });

    return NextResponse.json({
      ok: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      suppressedCount: result.suppressedCount,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Telegram signal alert failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}

function readTelegramSignalEvent(body: object): TelegramSignalEvent {
  const record = body as Record<string, unknown>;
  const eventType = readTelegramSignalEventType(record.eventType);
  const strategyId = readRequiredString(record.strategyId, 'strategyId');
  const symbolId = readRequiredString(record.symbolId, 'symbolId').toUpperCase();
  const occurredAt = readOptionalIsoString(record.occurredAt) ?? new Date().toISOString();

  return {
    eventType,
    strategyId,
    strategyName: readOptionalString(record.strategyName),
    symbolId,
    timeframe: readOptionalString(record.timeframe),
    price: readOptionalNumber(record.price),
    stopLossPrice: readOptionalNumber(record.stopLossPrice ?? record.stopLoss),
    takeProfitPrices: readTakeProfitPrices(record),
    occurredAt,
  };
}

function readTelegramSignalEventType(value: unknown): TelegramSignalEventType {
  const eventType = String(value || '').trim();
  if (TELEGRAM_SIGNAL_EVENT_TYPES.includes(eventType as TelegramSignalEventType)) {
    return eventType as TelegramSignalEventType;
  }
  throw new Error('Unsupported Telegram signal event type');
}

function readRequiredString(value: unknown, fieldName: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${fieldName} is required`);
  return text;
}

function readOptionalString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readTakeProfitPrices(record: Record<string, unknown>): number[] | undefined {
  const source = record.takeProfitPrices ?? record.takeProfits ?? record.takeProfitPrice ?? record.takeProfit;
  if (Array.isArray(source)) {
    const prices = source
      .map((value) => readOptionalNumber(value))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return prices.length ? prices : undefined;
  }
  const price = readOptionalNumber(source);
  return typeof price === 'number' ? [price] : undefined;
}

function readOptionalIsoString(value: unknown): string | undefined {
  const text = readOptionalString(value);
  if (!text) return undefined;
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
