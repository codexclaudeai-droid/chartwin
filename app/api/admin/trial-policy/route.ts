import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAsyncFreeTrialPolicySettings,
  getAdminMutationErrorStatus,
  guardMutationRequest,
  updateAsyncFreeTrialPolicySettings,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  try {
    const settings = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return getAsyncFreeTrialPolicySettings(repository);
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'free trial policy unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  try {
    assertSameOriginMutationRequest(request);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'cross-site request blocked',
    }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();
  try {
    const settings = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return updateAsyncFreeTrialPolicySettings(repository, {
        admin,
        baseDurationDays: normalizeDays(body.baseDurationDays, 7),
        eventEnabled: Boolean(body.eventEnabled),
        eventStartsAt: normalizeNullableString(body.eventStartsAt),
        eventEndsAt: normalizeNullableString(body.eventEndsAt),
        eventDurationDays: normalizeNullableDays(body.eventDurationDays),
        eventAllowReapply: Boolean(body.eventAllowReapply),
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'free trial policy update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

function normalizeDays(value: unknown, fallback: number): number {
  const days = Number(value);
  return Number.isFinite(days) ? days : fallback;
}

function normalizeNullableDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const days = Number(value);
  return Number.isFinite(days) ? days : null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
