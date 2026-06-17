import type {
  ChartServiceRepository,
  TelegramBotProfileRecord,
  TelegramDeliveryLogRecord,
  TelegramSignalEventType,
} from './repository.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';

export const TELEGRAM_SIGNAL_EVENT_TYPES: TelegramSignalEventType[] = [
  'buy',
  'sell',
  'stop_loss',
  'take_profit',
];

export type PublicTelegramBotProfile = Omit<TelegramBotProfileRecord, 'botToken'> & {
  maskedBotToken: string;
  hasBotToken: boolean;
};

export type TelegramSignalEvent = {
  eventType: TelegramSignalEventType;
  strategyId: string;
  strategyName?: string;
  signalSource?: string;
  executionMode?: string;
  fillModel?: string;
  symbolId: string;
  timeframe?: string;
  price?: number;
  stopLossPrice?: number;
  takeProfitPrices?: number[];
  occurredAt: string;
};

export type TelegramBotProfileInput = {
  id?: string | null;
  name?: string | null;
  botToken?: string | null;
  chatId?: string | null;
  isEnabled?: boolean | null;
  eventTypes?: unknown;
  strategyIds?: unknown;
  symbolIds?: unknown;
  timeframeIds?: unknown;
};

export type TelegramFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
};

export type TelegramFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<TelegramFetchResponse>;

export function maskTelegramBotToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return '****';
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function toPublicTelegramBotProfile(profile: TelegramBotProfileRecord): PublicTelegramBotProfile {
  const { botToken: _botToken, ...publicProfile } = profile;
  return {
    ...publicProfile,
    timeframeIds: getProfileTimeframeIds(profile),
    maskedBotToken: maskTelegramBotToken(profile.botToken),
    hasBotToken: Boolean(profile.botToken.trim()),
  };
}

export function listPublicTelegramBotProfiles(repository: ChartServiceRepository): PublicTelegramBotProfile[] {
  return repository.listTelegramBotProfiles().map(toPublicTelegramBotProfile);
}

export function createOrUpdateTelegramBotProfile(
  repository: ChartServiceRepository,
  input: TelegramBotProfileInput,
  now = new Date().toISOString(),
): TelegramBotProfileRecord {
  const id = input.id?.trim() || repository.nextId('telegram_profile');
  const current = repository.getTelegramBotProfileById(id);
  const botToken = input.botToken?.trim() || current?.botToken || '';
  const chatId = input.chatId?.trim() || current?.chatId || '';
  if (!botToken) throw new Error('Telegram bot token is required');
  if (!chatId) throw new Error('Telegram chat ID is required');

  const profile: TelegramBotProfileRecord = {
    id,
    name: input.name?.trim() || current?.name || 'Telegram Bot',
    botToken,
    chatId,
    isEnabled: typeof input.isEnabled === 'boolean' ? input.isEnabled : current?.isEnabled ?? true,
    eventTypes: normalizeTelegramEventTypes(input.eventTypes, current?.eventTypes),
    strategyIds: normalizeStringList(input.strategyIds, current?.strategyIds),
    symbolIds: normalizeUpperStringList(input.symbolIds, current?.symbolIds),
    timeframeIds: normalizeStringList(input.timeframeIds, current?.timeframeIds),
    lastTestedAt: current?.lastTestedAt ?? null,
    lastTestStatus: current?.lastTestStatus ?? null,
    lastTestError: current?.lastTestError ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  repository.saveTelegramBotProfile(profile);
  return profile;
}

export function getEnabledTelegramProfilesForSignal(
  repository: ChartServiceRepository,
  event: TelegramSignalEvent,
): TelegramBotProfileRecord[] {
  return filterTelegramProfilesForSignal(repository.listTelegramBotProfiles(), event);
}

export function filterTelegramProfilesForSignal(
  profiles: TelegramBotProfileRecord[],
  event: TelegramSignalEvent,
): TelegramBotProfileRecord[] {
  return profiles
    .filter((profile) => profile.isEnabled)
    .filter((profile) => profile.eventTypes.length === 0 || profile.eventTypes.includes(event.eventType))
    .filter((profile) => profile.strategyIds.length === 0 || profile.strategyIds.includes(event.strategyId))
    .filter((profile) => {
      const symbolId = event.symbolId.trim().toUpperCase();
      return profile.symbolIds.length === 0 || profile.symbolIds.includes(symbolId);
    })
    .filter((profile) => {
      const timeframe = event.timeframe?.trim();
      const timeframeIds = getProfileTimeframeIds(profile);
      return timeframeIds.length === 0 || Boolean(timeframe && timeframeIds.includes(timeframe));
    });
}

export async function sendTelegramAlertForSignal(
  repository: ChartServiceRepository,
  event: TelegramSignalEvent,
  fetcher: TelegramFetch = defaultTelegramFetch,
): Promise<{
  sentCount: number;
  failedCount: number;
  logs: TelegramDeliveryLogRecord[];
}> {
  const profiles = getEnabledTelegramProfilesForSignal(repository, event);
  const logs: TelegramDeliveryLogRecord[] = [];
  const message = formatTelegramSignalMessage(event);

  for (const profile of profiles) {
    const createdAt = new Date().toISOString();
    try {
      const telegramMessageId = await sendTelegramBotMessage(profile, message, fetcher);
      const log = createTelegramDeliveryLog(repository, profile, event, message, {
        status: 'sent',
        telegramMessageId,
        errorMessage: null,
        createdAt,
      });
      repository.saveTelegramDeliveryLog(log);
      logs.push(log);
    } catch (error) {
      const log = createTelegramDeliveryLog(repository, profile, event, message, {
        status: 'failed',
        telegramMessageId: null,
        errorMessage: toReadableErrorMessage(error),
        createdAt,
      });
      repository.saveTelegramDeliveryLog(log);
      logs.push(log);
    }
  }

  return {
    sentCount: logs.filter((log) => log.status === 'sent').length,
    failedCount: logs.filter((log) => log.status === 'failed').length,
    logs,
  };
}

export async function sendAsyncTelegramAlertForSignal(
  repository: AsyncChartServiceRepository,
  event: TelegramSignalEvent,
  fetcher: TelegramFetch = defaultTelegramFetch,
): Promise<{
  sentCount: number;
  failedCount: number;
  logs: TelegramDeliveryLogRecord[];
}> {
  const profiles = filterTelegramProfilesForSignal(await repository.listTelegramBotProfiles(), event);
  const logs: TelegramDeliveryLogRecord[] = [];
  const message = formatTelegramSignalMessage(event);

  for (const profile of profiles) {
    const createdAt = new Date().toISOString();
    try {
      const telegramMessageId = await sendTelegramBotMessage(profile, message, fetcher);
      const log = createTelegramDeliveryLogWithId(await repository.nextId('telegram_delivery'), profile, event, message, {
        status: 'sent',
        telegramMessageId,
        errorMessage: null,
        createdAt,
      });
      await repository.saveTelegramDeliveryLog(log);
      logs.push(log);
    } catch (error) {
      const log = createTelegramDeliveryLogWithId(await repository.nextId('telegram_delivery'), profile, event, message, {
        status: 'failed',
        telegramMessageId: null,
        errorMessage: toReadableErrorMessage(error),
        createdAt,
      });
      await repository.saveTelegramDeliveryLog(log);
      logs.push(log);
    }
  }

  return {
    sentCount: logs.filter((log) => log.status === 'sent').length,
    failedCount: logs.filter((log) => log.status === 'failed').length,
    logs,
  };
}

export async function sendTelegramProfileTestMessage(
  repository: ChartServiceRepository,
  profileId: string,
  fetcher: TelegramFetch = defaultTelegramFetch,
  now = new Date().toISOString(),
): Promise<PublicTelegramBotProfile> {
  const profile = repository.getTelegramBotProfileById(profileId);
  if (!profile) throw new Error(`Telegram profile not found: ${profileId}`);

  try {
    await sendTelegramBotMessage(profile, `Telegram alert test from ${profile.name}`, fetcher);
    const next = {
      ...profile,
      lastTestedAt: now,
      lastTestStatus: 'success' as const,
      lastTestError: null,
      updatedAt: now,
    };
    repository.saveTelegramBotProfile(next);
    return toPublicTelegramBotProfile(next);
  } catch (error) {
    const next = {
      ...profile,
      lastTestedAt: now,
      lastTestStatus: 'failed' as const,
      lastTestError: toReadableErrorMessage(error),
      updatedAt: now,
    };
    repository.saveTelegramBotProfile(next);
    return toPublicTelegramBotProfile(next);
  }
}

export async function sendAsyncTelegramProfileTestMessage(
  repository: AsyncChartServiceRepository,
  profileId: string,
  fetcher: TelegramFetch = defaultTelegramFetch,
  now = new Date().toISOString(),
): Promise<PublicTelegramBotProfile> {
  const profile = await repository.getTelegramBotProfileById(profileId);
  if (!profile) throw new Error(`Telegram profile not found: ${profileId}`);

  try {
    await sendTelegramBotMessage(profile, `Telegram alert test from ${profile.name}`, fetcher);
    const next = {
      ...profile,
      lastTestedAt: now,
      lastTestStatus: 'success' as const,
      lastTestError: null,
      updatedAt: now,
    };
    await repository.saveTelegramBotProfile(next);
    return toPublicTelegramBotProfile(next);
  } catch (error) {
    const next = {
      ...profile,
      lastTestedAt: now,
      lastTestStatus: 'failed' as const,
      lastTestError: toReadableErrorMessage(error),
      updatedAt: now,
    };
    await repository.saveTelegramBotProfile(next);
    return toPublicTelegramBotProfile(next);
  }
}

export function formatTelegramSignalMessage(event: TelegramSignalEvent): string {
  const side = formatTelegramEventType(event.eventType);
  const takeProfitPrices = normalizeTakeProfitPrices(event.takeProfitPrices);
  const parts = [
    `${side} ${event.symbolId.trim().toUpperCase()}`,
    event.timeframe ? `TF: ${event.timeframe}` : null,
    typeof event.price === 'number' && Number.isFinite(event.price) ? `Price: ${event.price}` : null,
    typeof event.stopLossPrice === 'number' && Number.isFinite(event.stopLossPrice) ? `S/L: ${event.stopLossPrice}` : null,
    takeProfitPrices.length ? `T/P: ${takeProfitPrices.join(', ')}` : null,
    `Time: ${formatTelegramEventTime(event.occurredAt)}`,
  ].filter(Boolean);
  return parts.join('\n');
}

export async function sendTelegramBotMessage(
  profile: TelegramBotProfileRecord,
  text: string,
  fetcher: TelegramFetch,
): Promise<string | null> {
  const response = await fetcher(
    `https://api.telegram.org/bot${profile.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: profile.chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );
  const payload = await response.json().catch(async () => ({
    ok: false,
    description: typeof response.text === 'function' ? await response.text() : '',
  }));
  if (!response.ok || !isTelegramOkPayload(payload)) {
    throw new Error(readTelegramError(payload) || `Telegram request failed with ${response.status}`);
  }
  const messageId = (payload.result as { message_id?: unknown } | undefined)?.message_id;
  return typeof messageId === 'number' || typeof messageId === 'string' ? String(messageId) : null;
}

function createTelegramDeliveryLog(
  repository: ChartServiceRepository,
  profile: TelegramBotProfileRecord,
  event: TelegramSignalEvent,
  message: string,
  result: Pick<TelegramDeliveryLogRecord, 'status' | 'telegramMessageId' | 'errorMessage' | 'createdAt'>,
): TelegramDeliveryLogRecord {
  return createTelegramDeliveryLogWithId(repository.nextId('telegram_delivery'), profile, event, message, result);
}

function createTelegramDeliveryLogWithId(
  id: string,
  profile: TelegramBotProfileRecord,
  event: TelegramSignalEvent,
  message: string,
  result: Pick<TelegramDeliveryLogRecord, 'status' | 'telegramMessageId' | 'errorMessage' | 'createdAt'>,
): TelegramDeliveryLogRecord {
  return {
    id,
    profileId: profile.id,
    eventType: event.eventType,
    strategyId: event.strategyId,
    symbolId: event.symbolId.trim().toUpperCase(),
    message,
    ...result,
  };
}

function normalizeTelegramEventTypes(value: unknown, fallback: TelegramSignalEventType[] = TELEGRAM_SIGNAL_EVENT_TYPES): TelegramSignalEventType[] {
  const allowed = new Set(TELEGRAM_SIGNAL_EVENT_TYPES);
  const values = Array.isArray(value) ? value : fallback;
  return values
    .map((item) => String(item).trim())
    .filter((item): item is TelegramSignalEventType => allowed.has(item as TelegramSignalEventType));
}

function normalizeStringList(value: unknown, fallback: string[] = []): string[] {
  const values = Array.isArray(value) ? value : fallback;
  return unique(values.map((item) => String(item).trim()).filter(Boolean));
}

function getProfileTimeframeIds(profile: TelegramBotProfileRecord): string[] {
  return Array.isArray(profile.timeframeIds) ? profile.timeframeIds : [];
}

function normalizeUpperStringList(value: unknown, fallback: string[] = []): string[] {
  return normalizeStringList(value, fallback).map((item) => item.toUpperCase());
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatTelegramEventType(eventType: TelegramSignalEventType): string {
  if (eventType === 'stop_loss') return 'S/L';
  if (eventType === 'take_profit') return 'T/P';
  return eventType.toUpperCase();
}

function formatTelegramEventTime(occurredAt: string): string {
  const timestampMs = Date.parse(occurredAt);
  if (!Number.isFinite(timestampMs)) return occurredAt;

  const kst = new Date(timestampMs + 9 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = pad(kst.getUTCFullYear() % 100);
  const month = pad(kst.getUTCMonth() + 1);
  const day = pad(kst.getUTCDate());
  const hour = pad(kst.getUTCHours());
  const minute = pad(kst.getUTCMinutes());
  const second = pad(kst.getUTCSeconds());
  return `${year}.${month}.${day} ${hour}:${minute}:${second} KST`;
}

function normalizeTakeProfitPrices(values: number[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .map((value) => String(value));
}

function isTelegramOkPayload(payload: unknown): payload is { ok: true; result?: unknown } {
  return Boolean(payload && typeof payload === 'object' && (payload as { ok?: unknown }).ok === true);
}

function readTelegramError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const description = (payload as { description?: unknown }).description;
  return typeof description === 'string' && description.trim() ? description : null;
}

function toReadableErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown Telegram error');
}

const defaultTelegramFetch: TelegramFetch = async (url, init) => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  return await fetch(url, init);
};
