import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  toPublicServiceUserRecord,
  verifyAsyncEmailWithToken,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const redirectUrl = new URL('/verify-email', request.url);
  if (token) redirectUrl.searchParams.set('token', token);
  return NextResponse.redirect(redirectUrl);
}

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
  return verifyEmail(String(body.token || ''));
}

async function verifyEmail(token: string) {
  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation((repository) => verifyAsyncEmailWithToken(repository, {
      token,
      verifiedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      user: toPublicServiceUserRecord(result.user),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'email verification failed',
    }, { status: 400 });
  }
}
