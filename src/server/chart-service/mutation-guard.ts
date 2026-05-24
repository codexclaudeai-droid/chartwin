import { NextResponse, type NextRequest } from 'next/server.js';
import { assertSameOriginMutationRequest } from './csrf.ts';
import {
  assertMutationRateLimitRequest,
  isRateLimitExceededError,
  type RateLimitOptions,
} from './rate-limit.ts';

export function guardMutationRequest(
  request: NextRequest,
  rateLimitOptions: RateLimitOptions = {},
): NextResponse | null {
  try {
    assertSameOriginMutationRequest(request);
    assertMutationRateLimitRequest(request, rateLimitOptions);
    return null;
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      const response = NextResponse.json({
        ok: false,
        message: error.message,
      }, { status: 429 });
      response.headers.set('Retry-After', String(error.retryAfterSeconds));
      return response;
    }

    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'cross-site request blocked',
    }, { status: 403 });
  }
}
