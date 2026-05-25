import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
  guardMutationRequest,
  registerAsyncMockUserAccount,
  saveAsyncSignupAgreementEvidence,
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
    const password = String(body.password || '');
    const passwordConfirm = String(body.passwordConfirm || '');
    if (password !== passwordConfirm) {
      throw new Error('Password confirmation does not match');
    }
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) {
      throw new Error('Required signup agreements must be accepted');
    }

    const acceptedAt = new Date().toISOString();
    const ipAddress = getRequestIpAddress(request);
    const userAgent = request.headers.get('user-agent')?.trim() || null;
    const { result, agreement } = await persistence.runMutation(async (repository) => {
      const webInfoSettings = await getAsyncWebInfoSettingsForDisplay(repository);
      const signupResult = await registerAsyncMockUserAccount(repository, {
        email: String(body.email || ''),
        name: String(body.name || ''),
        password,
        phoneNumber: String(body.phoneNumber || ''),
        referralCode: typeof body.referralCode === 'string' ? body.referralCode : '',
        createdAt: acceptedAt,
      });
      const signupAgreement = await saveAsyncSignupAgreementEvidence(repository, {
        userId: signupResult.user.id,
        acceptedAt,
        webInfoSettings,
        ipAddress,
        userAgent,
      });
      return { result: signupResult, agreement: signupAgreement };
    });
    const response = NextResponse.json({
      ok: true,
      user: toPublicServiceUserRecord(result.user),
      session: {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      },
      agreement: {
        id: agreement.id,
        userId: agreement.userId,
        termsAcceptedAt: agreement.termsAcceptedAt,
        privacyAcceptedAt: agreement.privacyAcceptedAt,
      },
    });
    response.headers.set('Set-Cookie', result.cookie);
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'signup failed',
    }, { status: 400 });
  }
}

function getRequestIpAddress(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedFor) return forwardedFor;
  return request.headers.get('x-real-ip')?.trim() || null;
}
