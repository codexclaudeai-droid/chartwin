import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
  markAllAsyncNotificationsReadForUser,
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
  try {
    const result = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return markAllAsyncNotificationsReadForUser(repository, {
        actor,
        readAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notification update failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
