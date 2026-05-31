import { NextResponse, type NextRequest } from 'next/server.js';
import {
  createSocialAuthAuthorizationUrl,
  createSocialAuthState,
  createSocialAuthStateCookie,
  isSocialAuthProvider,
} from '../../../../../../src/server/chart-service/index.ts';

type SocialAuthRouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: NextRequest, context: SocialAuthRouteContext) {
  const { provider: providerInput } = await context.params;
  if (!isSocialAuthProvider(providerInput)) {
    return NextResponse.json({ ok: false, message: 'Unsupported social auth provider' }, { status: 404 });
  }

  try {
    const state = createSocialAuthState();
    const authorizationUrl = createSocialAuthAuthorizationUrl({
      provider: providerInput,
      requestUrl: request.url,
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set('Set-Cookie', createSocialAuthStateCookie(providerInput, state));
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'social auth is not configured',
    }, { status: 400 });
  }
}
