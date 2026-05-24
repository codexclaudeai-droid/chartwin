import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAdminMutationErrorStatus,
  guardMutationRequest,
  replyAsyncToSupportThreadAsAdmin,
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
      return replyAsyncToSupportThreadAsAdmin(repository, {
        admin,
        threadId: String(body.threadId || ''),
        body: String(body.body || ''),
        createdAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'support reply failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
