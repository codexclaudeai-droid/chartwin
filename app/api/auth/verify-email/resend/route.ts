import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  resendAsyncEmailVerification,
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
  await persistence.runMutation((repository) => resendAsyncEmailVerification(repository, {
    email: String(body.email || ''),
    requestedAt: new Date().toISOString(),
  }));

  return NextResponse.json({
    ok: true,
    message: '가입된 미인증 이메일이라면 인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.',
  });
}
