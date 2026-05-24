import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  createClearSessionCookie,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  parseSessionCookie,
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

  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (sessionId) {
    await getAsyncChartServicePersistence().runMutation((repository) => repository.deleteSession(sessionId));
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', createClearSessionCookie());
  return response;
}
