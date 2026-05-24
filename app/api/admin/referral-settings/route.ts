import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  getAsyncReferralProgramSettings,
  guardMutationRequest,
  updateAsyncReferralProgramSettings,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return getAsyncReferralProgramSettings(repository);
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'referral settings unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const rewardPercent = Number(body.rewardPercent);
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return updateAsyncReferralProgramSettings(repository, {
        admin,
        rewardPercent,
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'referral settings update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
