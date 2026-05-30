import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  createClearSessionCookie,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  getAsyncUserDashboardSummary,
  guardMutationRequest,
  updateAsyncAuthenticatedUserProfile,
  withdrawAsyncAuthenticatedUserAccount,
} from '../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const dashboard = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return getAsyncUserDashboardSummary(repository, { actor });
    });
    return NextResponse.json({
      ok: true,
      dashboard,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'profile unavailable',
    }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
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

  let actor;
  try {
    actor = await persistence.runRead((repository) => getActorFromAsyncRequest(repository, request, new Date().toISOString()));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'profile unavailable',
    }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const dashboard = await persistence.runMutation(async (repository) => {
      await updateAsyncAuthenticatedUserProfile(repository, {
        actor,
        name: String(body.name || ''),
        phoneNumber: Object.hasOwn(body, 'phoneNumber') ? String(body.phoneNumber || '') : undefined,
        currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : undefined,
        newPassword: typeof body.newPassword === 'string' ? body.newPassword : undefined,
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
      message: error instanceof Error ? error.message : 'profile update failed',
    }, { status: 400 });
  }
}

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

  const persistence = getAsyncChartServicePersistence();

  try {
    const result = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return withdrawAsyncAuthenticatedUserAccount(repository, {
        actor,
        withdrawnAt: new Date().toISOString(),
      });
    });
    const response = NextResponse.json({
      ok: true,
      deletedSessionCount: result.deletedSessionCount,
    });
    response.headers.set('Set-Cookie', createClearSessionCookie());
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'profile withdrawal failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}
