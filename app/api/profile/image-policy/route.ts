import { NextResponse, type NextRequest } from 'next/server.js';
import { validateProfileImageUpload } from '../../../../src/domain/chart-service/index.ts';
import {
  assertSameOriginMutationRequest,
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
  try {
    const policy = await persistence.runMutation(async (repository) => {
      await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return validateProfileImageUpload({
        filename: String(body.filename || ''),
        mimeType: String(body.mimeType || ''),
        sizeBytes: Number(body.sizeBytes || 0),
      });
    });

    return NextResponse.json({
      ok: policy.ok,
      policy,
    }, { status: policy.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'profile unavailable',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
