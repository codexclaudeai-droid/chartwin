import {
  getAsyncChartServicePersistence,
  toPublicTelegramBotProfile,
  type AsyncChartServiceRepository,
  type TelegramBotProfileInput,
  type TelegramBotProfileRecord,
} from '../../../src/server/chart-service/index.ts';
import {
  requireSignalSuperAdmin,
  signalAdminJson,
} from '../signal-admin-settings.ts';

export async function GET(request: Request) {
  try {
    await requireSignalSuperAdmin(request);
  } catch (error) {
    return unauthorizedJson(error);
  }

  const persistence = getAsyncChartServicePersistence();
  const payload = await persistence.runRead(async (repository) => ({
    ok: true,
    profiles: (await repository.listTelegramBotProfiles()).map(toPublicTelegramBotProfile),
    logs: await repository.listTelegramDeliveryLogs(50),
  }));
  return signalAdminJson(payload);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return signalAdminJson({ ok: false, message: 'invalid json' }, { status: 400 });
  }

  try {
    await requireSignalSuperAdmin(request);
  } catch (error) {
    return unauthorizedJson(error);
  }

  try {
    const persistence = getAsyncChartServicePersistence();
    const profile = await persistence.runMutation(async (repository) => (
      await createOrUpdateProfile(repository, body as TelegramBotProfileInput)
    ));
    return signalAdminJson({ ok: true, profile: toPublicTelegramBotProfile(profile) });
  } catch (error) {
    return signalAdminJson({ ok: false, message: toReadableErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSignalSuperAdmin(request);
  } catch (error) {
    return unauthorizedJson(error);
  }

  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return signalAdminJson({ ok: false, message: 'profile id required' }, { status: 400 });

  const persistence = getAsyncChartServicePersistence();
  await persistence.runMutation(async (repository) => {
    await repository.deleteTelegramBotProfile(id);
  });
  return signalAdminJson({ ok: true });
}

async function createOrUpdateProfile(
  repository: AsyncChartServiceRepository,
  input: TelegramBotProfileInput,
): Promise<TelegramBotProfileRecord> {
  const now = new Date().toISOString();
  const id = input.id?.trim() || await repository.nextId('telegram_profile');
  const current = input.id ? await repository.getTelegramBotProfileById(id) : null;
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
    eventTypes: normalizeEventTypes(input.eventTypes, current?.eventTypes),
    strategyIds: normalizeStringList(input.strategyIds, current?.strategyIds),
    symbolIds: normalizeUpperStringList(input.symbolIds, current?.symbolIds),
    timeframeIds: normalizeStringList(input.timeframeIds, current?.timeframeIds),
    lastTestedAt: current?.lastTestedAt ?? null,
    lastTestStatus: current?.lastTestStatus ?? null,
    lastTestError: current?.lastTestError ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await repository.saveTelegramBotProfile(profile);
  return profile;
}

function normalizeEventTypes(value: unknown, fallback: TelegramBotProfileRecord['eventTypes'] = ['buy', 'sell', 'stop_loss', 'take_profit']) {
  const allowed = new Set(['buy', 'sell', 'stop_loss', 'take_profit']);
  const source = Array.isArray(value) ? value : fallback;
  return Array.from(new Set(source
    .map((item) => String(item).trim())
    .filter((item): item is TelegramBotProfileRecord['eventTypes'][number] => allowed.has(item))));
}

function normalizeStringList(value: unknown, fallback: string[] = []) {
  const source = Array.isArray(value) ? value : fallback;
  return Array.from(new Set(source.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeUpperStringList(value: unknown, fallback: string[] = []) {
  return normalizeStringList(value, fallback).map((item) => item.toUpperCase());
}

function unauthorizedJson(error: unknown) {
  const message = toReadableErrorMessage(error) || 'unauthorized';
  return signalAdminJson({ ok: false, message }, { status: message.includes('Super admin') ? 403 : 401 });
}

function toReadableErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}
