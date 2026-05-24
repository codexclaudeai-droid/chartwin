import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  requestAsyncPasswordReset,
} from '../../../../../src/server/chart-service/index.ts';

const PASSWORD_RESET_ACCEPTED_MESSAGE = 'If the account exists, password reset instructions will be sent.';

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
  const result = await persistence.runMutation((repository) => requestAsyncPasswordReset(repository, {
    email: String(body.email || ''),
    requestedAt: new Date().toISOString(),
  }));
  const payload: {
    ok: true;
    message: string;
    resetTokenPreview?: string;
    expiresAt?: string | null;
  } = {
    ok: true,
    message: PASSWORD_RESET_ACCEPTED_MESSAGE,
  };

  if (process.env.NODE_ENV !== 'production' && result.token) {
    payload.resetTokenPreview = result.token;
    payload.expiresAt = result.expiresAt;
  }

  return NextResponse.json(payload);
}

