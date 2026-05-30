import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
  requestAsyncFreeTrial,
} from '../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation(async (repository) => {
      const requestedAt = new Date().toISOString();
      const actor = await getActorFromAsyncRequest(repository, request, requestedAt);
      return requestAsyncFreeTrial(repository, { actor, requestedAt });
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'free trial request failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
