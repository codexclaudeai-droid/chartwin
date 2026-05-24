import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  authenticateAsyncUserWithPassword,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  toPublicServiceUserRecord,
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
    const result = await persistence.runMutation((repository) => authenticateAsyncUserWithPassword(repository, {
      email: String(body.email || ''),
      password: String(body.password || ''),
      createdAt: new Date().toISOString(),
    }));
    const response = NextResponse.json({
      ok: true,
      session: {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      },
      user: toPublicServiceUserRecord(result.user),
    });
    response.headers.set('Set-Cookie', result.cookie);
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'invalid credentials',
    }, { status: 401 });
  }
}
