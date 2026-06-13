import { NextResponse, type NextRequest } from 'next/server.js';
import {
  completeAsyncSocialAuth,
  createClearSocialAuthStateCookie,
  exchangeSocialAuthCode,
  getAsyncChartServicePersistence,
  getSocialAuthRuntimeEnvAsync,
  isSocialAuthProvider,
  readSocialAuthStateCookie,
  SOCIAL_AUTH_WITHDRAWN_LOGIN_ERROR,
} from '../../../../../../src/server/chart-service/index.ts';

type SocialAuthRouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: NextRequest, context: SocialAuthRouteContext) {
  const { provider: providerInput } = await context.params;
  if (!isSocialAuthProvider(providerInput)) {
    return NextResponse.json({ ok: false, message: 'Unsupported social auth provider' }, { status: 404 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const cookieState = readSocialAuthStateCookie(request.headers.get('cookie'), providerInput);
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ ok: false, message: 'Invalid social auth callback state' }, { status: 400 });
  }
  const socialAuthStartedFromSignup = state.startsWith('signup.');

  try {
    const env = await getSocialAuthRuntimeEnvAsync();
    const profile = await exchangeSocialAuthCode(providerInput, {
      code,
      requestUrl: request.url,
      state,
      env,
    });
    const persistence = getAsyncChartServicePersistence();
    const result = await persistence.runMutation((repository) => completeAsyncSocialAuth(repository, {
      profile,
      createdAt: new Date().toISOString(),
      allowWithdrawnReactivation: socialAuthStartedFromSignup,
    }));
    const redirectPath = result.userLifecycle === 'created' || result.userLifecycle === 'reactivated'
      ? '/main?signup=complete'
      : socialAuthStartedFromSignup
        ? '/main?signup=existing'
        : '/main';
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.headers.append('Set-Cookie', result.cookie);
    response.headers.append('Set-Cookie', createClearSocialAuthStateCookie(providerInput));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === SOCIAL_AUTH_WITHDRAWN_LOGIN_ERROR) {
      const response = NextResponse.redirect(new URL('/login?withdrawn=1', request.url));
      response.headers.append('Set-Cookie', createClearSocialAuthStateCookie(providerInput));
      return response;
    }
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'social auth failed',
    }, { status: 400 });
  }
}
