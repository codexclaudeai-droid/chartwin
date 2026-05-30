import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  guardMutationRequest,
} from '../../../../src/server/chart-service/index.ts';

const MAX_SETTINGS_BYTES = 100_000;

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const record = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return repository.getChartUserSettings(actor.id);
    });

    return NextResponse.json({
      ok: true,
      settings: record?.settings ?? {},
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'chart settings unavailable',
    }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request, { scope: 'chart-settings', windowMs: 10_000, limit: 30 });
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const settings = sanitizeSettings((body as { settings?: unknown }).settings);

  if (!settings) {
    return NextResponse.json({
      ok: false,
      message: 'Invalid chart settings payload',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();

  try {
    const saved = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      const record = {
        userId: actor.id,
        settings,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveChartUserSettings(record);
      return record;
    });

    return NextResponse.json({
      ok: true,
      settings: saved.settings,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'chart settings save failed',
    }, { status: 401 });
  }
}

function sanitizeSettings(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;

  try {
    const json = JSON.stringify(value);
    if (!json || new TextEncoder().encode(json).byteLength > MAX_SETTINGS_BYTES) {
      return null;
    }
    const parsed = JSON.parse(json) as unknown;
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
