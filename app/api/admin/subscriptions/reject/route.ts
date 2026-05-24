import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAdminMutationErrorStatus,
  guardMutationRequest,
  rejectAsyncSubscriptionRequest,
} from '../../../../../src/server/chart-service/index.ts';

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

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const subscription = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return rejectAsyncSubscriptionRequest(repository, {
        subscriptionId: String(body.subscriptionId || ''),
        admin,
        rejectedAt: new Date().toISOString(),
        adminNote: String(body.adminNote || ''),
      });
    });
    return NextResponse.json({
      ok: true,
      subscription,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'subscription rejection failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
