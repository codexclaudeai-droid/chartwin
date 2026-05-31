import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  getAsyncPointProgramSettings,
  guardMutationRequest,
  updateAsyncPointProgramSettings,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return getAsyncPointProgramSettings(repository);
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'point settings unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return updateAsyncPointProgramSettings(repository, {
        admin,
        subscriberCashbackPercent: Number(body.subscriberCashbackPercent),
        rewardPercent: Number(body.rewardPercent),
        salespersonRewardPercent: Number(body.salespersonRewardPercent),
        salesTeamRewardPercent: Number(body.salesTeamRewardPercent),
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'point settings update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
