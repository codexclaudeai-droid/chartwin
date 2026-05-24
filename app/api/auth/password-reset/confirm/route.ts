import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  resetAsyncPasswordWithToken,
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
    await persistence.runMutation((repository) => resetAsyncPasswordWithToken(repository, {
      token: String(body.token || ''),
      password: String(body.password || ''),
      resetAt: new Date().toISOString(),
    }));
    return NextResponse.json({
      ok: true,
      message: 'Password has been reset.',
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'password reset failed',
    }, { status: 400 });
  }
}

