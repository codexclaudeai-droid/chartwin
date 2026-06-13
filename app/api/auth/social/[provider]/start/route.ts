import { NextResponse, type NextRequest } from 'next/server.js';
import {
  createCanonicalSocialAuthStartUrl,
  createSocialAuthAuthorizationUrl,
  createSocialAuthState,
  createSocialAuthStateCookie,
  getSocialAuthRuntimeEnvAsync,
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
    const env = await getSocialAuthRuntimeEnvAsync();
    const canonicalStartUrl = createCanonicalSocialAuthStartUrl({
      provider: providerInput,
      requestUrl: request.url,
      env,
    });
    if (canonicalStartUrl) {
      return NextResponse.redirect(canonicalStartUrl);
    }

    const state = createSocialAuthState();
    const authorizationUrl = createSocialAuthAuthorizationUrl({
      provider: providerInput,
      requestUrl: request.url,
      state,
      env,
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
