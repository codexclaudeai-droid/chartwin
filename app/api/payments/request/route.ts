import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  createAsyncAuthenticatedManualPaymentRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
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

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();
  const now = new Date().toISOString();
  try {
    const result = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, now);
      return createAsyncAuthenticatedManualPaymentRequest(repository, {
        actor,
        planId: String(body.planId || 'plan_monthly'),
        method: body.method === 'usdt' ? 'usdt' : 'bank_transfer',
        requestedAt: now,
        depositorName: typeof body.depositorName === 'string' ? body.depositorName : undefined,
        transactionId: typeof body.transactionId === 'string' ? body.transactionId : undefined,
        exchangeRate: typeof body.exchangeRate === 'number' ? body.exchangeRate : null,
        referralPointsUsed: typeof body.referralPointsUsed === 'number' ? body.referralPointsUsed : 0,
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'payment request failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
