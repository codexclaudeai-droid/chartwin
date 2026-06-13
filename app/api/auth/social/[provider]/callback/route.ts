import { NextResponse, type NextRequest } from 'next/server.js';
import {
  completeAsyncSocialAuth,
  createClearSocialAuthStateCookie,
  exchangeSocialAuthCode,
  getAsyncChartServicePersistence,
  getSocialAuthRuntimeEnvAsync,
  isSocialAuthProvider,
  readSocialAuthStateCookie,
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
    }));
    const response = NextResponse.redirect(new URL('/main', request.url));
    response.headers.append('Set-Cookie', result.cookie);
    response.headers.append('Set-Cookie', createClearSocialAuthStateCookie(providerInput));
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'social auth failed',
    }, { status: 400 });
  }
}
