import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  getAsyncUserDashboardSummary,
  guardMutationRequest,
  updateAsyncAuthenticatedUserProfileImage,
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
    const dashboard = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      await updateAsyncAuthenticatedUserProfileImage(repository, {
        actor,
        filename: String(body.filename || ''),
        mimeType: String(body.mimeType || ''),
        sizeBytes: Number(body.sizeBytes || 0),
        dataUrl: String(body.dataUrl || ''),
      });
      return getAsyncUserDashboardSummary(repository, { actor });
    });

    return NextResponse.json({
      ok: true,
      dashboard,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'profile image upload failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
