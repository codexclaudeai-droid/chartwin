import { NextResponse, type NextRequest } from 'next/server.js';
import {
  archiveAsyncNotificationForUser,
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
} from '../../../../../src/server/chart-service/index.ts';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
    const params = await context.params;
    const notification = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return archiveAsyncNotificationForUser(repository, {
        actor,
        notificationId: params.id,
        archivedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({
      ok: true,
      notification,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notification archive failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
