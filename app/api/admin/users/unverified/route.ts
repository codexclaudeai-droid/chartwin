import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  purgeAsyncUnverifiedUserAccount,
} from '../../../../../src/server/chart-service/index.ts';

export async function DELETE(request: NextRequest) {
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
    const result = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return purgeAsyncUnverifiedUserAccount(repository, {
        admin,
        email: String(body.email || ''),
        purgedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({
      ok: true,
      purgedUserId: result.user.id,
      email: result.user.email,
      deletedSessionCount: result.deletedSessionCount,
      deletedEmailOutboxCount: result.deletedEmailOutboxCount,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unverified user purge failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
