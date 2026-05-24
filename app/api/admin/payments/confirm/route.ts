import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  confirmAsyncManualPaymentAndActivateSubscription,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAdminMutationErrorStatus,
  guardMutationRequest,
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
    const result = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return confirmAsyncManualPaymentAndActivateSubscription(repository, {
        paymentId: String(body.paymentId || 'pay_pending'),
        admin,
        confirmedAt: new Date().toISOString(),
        adminNote: typeof body.adminNote === 'string' ? body.adminNote : undefined,
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'payment confirmation failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
