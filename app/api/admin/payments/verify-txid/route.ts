import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  verifyAsyncPaymentTransactionId,
} from '../../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return verifyAsyncPaymentTransactionId(repository, {
        paymentId: String(body.paymentId || ''),
        admin,
        checkedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'TXID verification failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
