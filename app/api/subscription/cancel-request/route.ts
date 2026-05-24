import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
  requestAsyncSubscriptionCancellation,
} from '../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
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

  const persistence = getAsyncChartServicePersistence();
  const now = new Date().toISOString();

  try {
    const subscription = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, now);
      return requestAsyncSubscriptionCancellation(repository, { actor, requestedAt: now });
    });
    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'cancel request failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
