import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  parseSessionCookie,
  registerAsyncMockUserAccount,
  registerMockUserAccount,
  resetChartServiceRateLimits,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('mock signup rejects weak passwords before creating a session', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(
    () => registerMockUserAccount(repository, {
      email: 'new@example.com',
      name: 'New User',
      password: 'weak',
      createdAt: '2026-05-23T10:00:00.000Z',
    }),
    /Password policy failed/,
  );
});

test('mock signup creates a member account and httpOnly session cookie', () => {
  const repository = createMockChartServiceRepository();

  const result = registerMockUserAccount(repository, {
    email: 'NEW@example.com',
    name: 'New User',
    password: 'Aa1!aaaa',
    phoneNumber: '010-2222-3333',
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.email, 'new@example.com');
  assert.equal(result.user.role, 'member');
  assert.equal(result.user.phoneNumber, '010-2222-3333');
  assert.equal(result.user.passwordHash?.includes('Aa1!aaaa'), false);
  assert.match(result.user.referralCode, /^[A-Z0-9]{6}$/);
  assert.doesNotMatch(result.user.referralCode, /^TC-/);
  assert.match(result.user.passwordHash ?? '', /^pbkdf2_sha256\$/);
  assert.match(result.cookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
});

test('mock users and new signups use unique six character referral codes', () => {
  const repository = createMockChartServiceRepository();

  const result = registerMockUserAccount(repository, {
    email: 'six-code@example.com',
    name: 'Six Code',
    password: 'Aa1!aaaa',
    createdAt: '2026-05-23T10:00:00.000Z',
  });
  const codes = repository.listUsers().map((user) => user.referralCode);

  assert.equal(codes.every((code) => /^[A-Z0-9]{6}$/.test(code)), true);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(codes.includes(result.user.referralCode), true);
});

test('mock signup stores the referrer from a referral code', () => {
  const repository = createMockChartServiceRepository();
  const referrer = repository.getUserById('user_subscriber');

  const result = registerMockUserAccount(repository, {
    email: 'referred@example.com',
    name: 'Referred User',
    password: 'Aa1!aaaa',
    referralCode: referrer?.referralCode,
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.referredByUserId, 'user_subscriber');
  assert.equal(repository.getUserByEmail('referred@example.com')?.referredByUserId, 'user_subscriber');
});

test('mock signup allows omitted referral codes without assigning a referrer', () => {
  const repository = createMockChartServiceRepository();

  const result = registerMockUserAccount(repository, {
    email: 'no-referral@example.com',
    name: 'No Referral',
    password: 'Aa1!aaaa',
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.referredByUserId, null);
  assert.equal(repository.getUserByEmail('no-referral@example.com')?.referredByUserId, null);
});

test('mock signup rejects an unknown referral code without creating the account', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(
    () => registerMockUserAccount(repository, {
      email: 'bad-referral@example.com',
      name: 'Bad Referral',
      password: 'Aa1!aaaa',
      referralCode: 'TC-NOTFOUND',
      createdAt: '2026-05-23T10:00:00.000Z',
    }),
    /Referral code not found/,
  );
  assert.equal(repository.getUserByEmail('bad-referral@example.com'), null);
});

test('async signup stores the referrer from a referral code', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const referrer = syncRepository.getUserById('user_subscriber');

  const result = await registerAsyncMockUserAccount(repository, {
    email: 'async-referred@example.com',
    name: 'Async Referred User',
    password: 'Aa1!aaaa',
    phoneNumber: '010-4444-5555',
    referralCode: referrer?.referralCode,
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.referredByUserId, 'user_subscriber');
  assert.equal(result.user.phoneNumber, '010-4444-5555');
  assert.match(result.user.referralCode, /^[A-Z0-9]{6}$/);
  assert.equal(syncRepository.getUserByEmail('async-referred@example.com')?.referredByUserId, 'user_subscriber');
});

test('async signup allows blank referral codes without assigning a referrer', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const result = await registerAsyncMockUserAccount(repository, {
    email: 'async-no-referral@example.com',
    name: 'Async No Referral',
    password: 'Aa1!aaaa',
    referralCode: '   ',
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.referredByUserId, null);
  assert.equal(syncRepository.getUserByEmail('async-no-referral@example.com')?.referredByUserId, null);
});

test('signup API stores the referrer from a referral code', async () => {
  const {
    getChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');
  const { POST } = await import('../app/api/auth/signup/route.ts');
  const referrer = getChartServiceRepository().getUserById('user_subscriber');

  resetChartServiceRateLimits();
  const response = await POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: `route-referred-${Date.now()}@example.com`,
      name: 'Route Referred User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaaa',
      phoneNumber: '010-7777-8888',
      acceptedTerms: true,
      acceptedPrivacy: true,
      referralCode: referrer?.referralCode,
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.user.referredByUserId, 'user_subscriber');
  assert.equal(payload.user.phoneNumber, '010-7777-8888');
  assert.match(payload.user.referralCode, /^[A-Z0-9]{6}$/);
});

test('signup API stores policy agreement evidence for the created account', async () => {
  const {
    getChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');
  const { POST } = await import('../app/api/auth/signup/route.ts');
  const repository = getChartServiceRepository();

  repository.saveWebInfoSettings({
    id: 'default',
    termsContent: '가입약관 증거 본문 v2',
    privacyContent: '개인정보보호정책 증거 본문 v2',
    updatedByAdminId: 'super_1',
    updatedAt: '2026-05-25T08:00:00.000Z',
  });

  resetChartServiceRateLimits();
  const response = await POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
      'user-agent': 'signup-agreement-test-agent',
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
    body: JSON.stringify({
      email: `route-agreement-evidence-${Date.now()}@example.com`,
      name: 'Agreement Evidence User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaaa',
      phoneNumber: '010-1212-3434',
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  }));
  const payload = await response.json();
  const agreements = repository.listSignupAgreementsByUserId(payload.user.id);

  assert.equal(response.status, 200);
  assert.equal(payload.agreement.userId, payload.user.id);
  assert.equal(agreements.length, 1);
  assert.equal(agreements[0].id, payload.agreement.id);
  assert.equal(agreements[0].termsContent, '가입약관 증거 본문 v2');
  assert.equal(agreements[0].privacyContent, '개인정보보호정책 증거 본문 v2');
  assert.equal(agreements[0].termsSettingsUpdatedAt, '2026-05-25T08:00:00.000Z');
  assert.equal(agreements[0].privacySettingsUpdatedAt, '2026-05-25T08:00:00.000Z');
  assert.equal(agreements[0].ipAddress, '203.0.113.10');
  assert.equal(agreements[0].userAgent, 'signup-agreement-test-agent');
  assert.equal(agreements[0].termsAcceptedAt, agreements[0].privacyAcceptedAt);
});

test('signup API rejects password confirmation mismatch and missing policy agreements', async () => {
  const { POST } = await import('../app/api/auth/signup/route.ts');

  resetChartServiceRateLimits();
  const mismatch = await POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: `route-mismatch-${Date.now()}@example.com`,
      name: 'Mismatch User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaab',
      phoneNumber: '010-1111-2222',
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  }));
  const missingAgreement = await POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: `route-agreement-${Date.now()}@example.com`,
      name: 'Agreement User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaaa',
      phoneNumber: '010-1111-3333',
      acceptedTerms: false,
      acceptedPrivacy: true,
    }),
  }));

  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).message, /Password confirmation does not match/);
  assert.equal(missingAgreement.status, 400);
  assert.match((await missingAgreement.json()).message, /Required signup agreements/);
});

test('signup API allows missing referral codes without assigning a referrer', async () => {
  const { POST } = await import('../app/api/auth/signup/route.ts');

  resetChartServiceRateLimits();
  const response = await POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: `route-no-referral-${Date.now()}@example.com`,
      name: 'Route No Referral User',
      password: 'Aa1!aaaa',
      passwordConfirm: 'Aa1!aaaa',
      phoneNumber: '010-9999-0000',
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.user.referredByUserId, null);
  assert.match(payload.user.referralCode, /^[A-Z0-9]{6}$/);
});

test('signup email check API reports duplicate and available addresses', async () => {
  const { GET } = await import('../app/api/auth/email-check/route.ts');

  const duplicateResponse = await GET(new Request('http://localhost/api/auth/email-check?email=member@example.com'));
  const duplicatePayload = await duplicateResponse.json();
  const availableResponse = await GET(new Request(`http://localhost/api/auth/email-check?email=available-${Date.now()}@example.com`));
  const availablePayload = await availableResponse.json();
  const invalidResponse = await GET(new Request('http://localhost/api/auth/email-check?email=invalid'));
  const invalidPayload = await invalidResponse.json();

  assert.equal(duplicateResponse.status, 200);
  assert.equal(duplicatePayload.available, false);
  assert.equal(duplicatePayload.message, '이미 가입된 이메일입니다.');
  assert.equal(availableResponse.status, 200);
  assert.equal(availablePayload.available, true);
  assert.equal(availablePayload.message, '사용 가능한 이메일입니다.');
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidPayload.message, '올바른 이메일을 입력해 주세요.');
});

test('signup referral check API reports a masked referrer preview', async () => {
  const {
    getChartServiceRepository,
  } = await import('../src/server/chart-service/index.ts');
  const { GET } = await import('../app/api/auth/referral-check/route.ts');
  const referrer = getChartServiceRepository().getUserById('user_subscriber');

  const successResponse = await GET(new Request(`http://localhost/api/auth/referral-check?code=${referrer?.referralCode}`));
  const successPayload = await successResponse.json();
  const missingResponse = await GET(new Request('http://localhost/api/auth/referral-check?code=NOUSER'));
  const missingPayload = await missingResponse.json();

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.found, true);
  assert.equal(successPayload.referrer.name, referrer?.name);
  assert.equal(successPayload.referrer.emailMasked.includes('@'), true);
  assert.notEqual(successPayload.referrer.emailMasked, referrer?.email);
  assert.equal(successPayload.referrer.email, undefined);
  assert.equal(missingResponse.status, 404);
  assert.equal(missingPayload.found, false);
});

test('signup panel captures referral codes from the signup URL', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /searchParams\.get\('ref'\)/);
  assert.match(source, /referralCode/);
  assert.match(source, /lockedReferralCode/);
  assert.match(source, /setLockedReferralCode\(referralCodeFromUrl\)/);
  assert.match(source, /checkReferralPreview\(referralCodeFromUrl\)/);
  assert.match(source, /\/api\/auth\/referral-check\?code=/);
  assert.match(source, /referrerPreview/);
  assert.match(source, /emailMasked/);
  assert.match(source, /signup-referrer-preview/);
  assert.match(source, /readOnly=\{Boolean\(lockedReferralCode\)\}/);
  assert.doesNotMatch(source, /추천링크로 적용된 추천코드/);
  assert.doesNotMatch(source, /가입 완료까지 고정됩니다/);
  assert.match(source, /signupReferralCode/);
  assert.match(source, /추천코드/);
});

test('signup panel lets manually entered referral codes be previewed', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /handleReferralCodeChange/);
  assert.match(source, /setReferrerPreview\(null\)/);
  assert.match(source, /referral-code-row/);
  assert.match(source, /checkReferralPreview\(referralCode\)/);
  assert.match(source, /추천인 확인/);
  assert.match(source, /disabled=\{isCheckingReferral \|\| !referralCode\.trim\(\)\}/);
  assert.match(source, /추천인을 확인하는 중입니다/);
  assert.match(source, /추천인:/);
  assert.match(cssSource, /\.referral-code-row/);
  assert.match(cssSource, /\.referral-code-row \.button/);
});

test('signup panel confirms completion then routes new members to redirect or home after signup', () => {
  const panelSource = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const redirectSource = readFileSync(new URL('../app/auth-redirect.ts', import.meta.url), 'utf8');

  assert.match(panelSource, /getSafeRedirectPath/);
  assert.match(panelSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(panelSource, /const nextPath = getSafeRedirectPath\(searchParams\) \?\? '\/'/);
  assert.match(panelSource, /회원가입이 정상 완료되었습니다/);
  assert.match(panelSource, /window\.setTimeout/);
  assert.match(panelSource, /window\.location\.assign\(nextPath\)/);
  assert.match(redirectSource, /getSafeRedirectPath/);
  assert.match(redirectSource, /window\.location\.assign\(redirect\)/);
});

test('signup panel labels referral code input as optional', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const referralField = source.match(/id="signupReferralCode"[\s\S]*?\/>/)?.[0] ?? '';

  assert.match(source, /추천코드 \(선택\)/);
  assert.match(source, /선택사항/);
  assert.doesNotMatch(referralField, /\brequired\b/);
});

test('signup panel requires phone password confirmation and policy agreement dropdowns', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /email-check-row/);
  assert.match(source, /checkEmailAvailability/);
  assert.match(source, /\/api\/auth\/email-check\?email=/);
  assert.match(source, /이메일 중복 확인을 먼저 완료해 주세요\./);
  assert.match(source, /확인 중/);
  assert.match(source, /확인/);
  assert.match(source, /setEmailCheck\(null\)/);
  assert.match(source, /isEmailConfirmed/);
  assert.match(source, /signupPhoneNumber/);
  assert.match(source, /phoneNumber/);
  assert.match(source, /handlePhoneNumberChange/);
  assert.match(source, /formatSignupPhoneNumber/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /maxLength=\{13\}/);
  assert.match(source, /signupPasswordConfirm/);
  assert.doesNotMatch(source, /signupPasswordHelp/);
  assert.doesNotMatch(source, /aria-describedby="signupPasswordHelp"/);
  assert.doesNotMatch(source, /8자리 이상, 영문 대문자, 숫자, 특수문자를 포함해 주세요\./);
  assert.match(source, /회원가입 정보를 입력하고 약관에 동의해 주세요\./);
  assert.doesNotMatch(source, /비밀번호는 8자 이상, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다\./);
  assert.match(source, /passwordConfirm/);
  assert.match(source, /acceptedTerms/);
  assert.match(source, /acceptedPrivacy/);
  assert.match(source, /signupTermsAgreement/);
  assert.match(source, /signupPrivacyAgreement/);
  assert.match(source, /<details/);
  assert.match(source, /\/api\/web-info/);
  assert.match(cssSource, /\.field-help/);
  assert.match(cssSource, /\.field-help\.success/);
  assert.match(cssSource, /\.field-help\.error/);
  assert.match(cssSource, /\.email-check-row/);
});

test('signup panel uses compact agreement rows and required field marks', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const nameField = source.match(/id="signupName"[\s\S]*?\/>/)?.[0] ?? '';
  const checkboxRowBlock = cssSource.match(/\.checkbox-row\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(source, /signup-policy-row/);
  assert.match(source, /가입약관 내용 확인/);
  assert.match(source, /개인정보보호정책 내용 확인/);
  assert.match(source, /동의합니다\./);
  assert.doesNotMatch(source, /가입약관에 동의합니다\./);
  assert.doesNotMatch(source, /개인정보보호정책에 동의합니다\./);
  assert.match(source, /<span className="required-mark" aria-hidden="true">\*<\/span>\s*이메일/);
  assert.match(source, /<span className="required-mark" aria-hidden="true">\*<\/span>\s*이름/);
  assert.match(source, /<span className="required-mark" aria-hidden="true">\*<\/span>\s*연락번호/);
  assert.match(source, /<span className="required-mark" aria-hidden="true">\*<\/span>\s*비밀번호/);
  assert.match(nameField, /\brequired\b/);
  assert.match(cssSource, /\.signup-policy-row/);
  assert.match(cssSource, /justify-content:\s*space-between/);
  assert.match(cssSource, /\.required-mark/);
  assert.match(cssSource, /\.signup-policy-box\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(cssSource, /\.signup-policy-box details\s*\{[\s\S]*?border:\s*0/);
  assert.match(cssSource, /\.checkbox-row\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(checkboxRowBlock, /color:\s*#ffffff/);
});

test('signup panel keeps email duplicate check compact and marks password confirmation required', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const emailButton = source.match(/<button className="button secondary" type="button" onClick=\{checkEmailAvailability\}[\s\S]*?<\/button>/)?.[0] ?? '';

  assert.match(emailButton, /중복확인/);
  assert.match(source, /<span className="required-mark" aria-hidden="true">\*<\/span>\s*비밀번호 확인/);
  assert.match(cssSource, /\.email-check-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(92px,\s*auto\)/);
  assert.match(cssSource, /\.email-check-row \.button\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(cssSource, /\.signup-policy-row\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(cssSource, /\.signup-policy-box summary\s*\{[\s\S]*?line-height:\s*1\.4/);
});

test('signup phone number formatter inserts hyphens while typing digits', async () => {
  const { formatSignupPhoneNumber } = await import('../app/signup/phone-format.ts');

  assert.equal(formatSignupPhoneNumber('010'), '010');
  assert.equal(formatSignupPhoneNumber('0101'), '010-1');
  assert.equal(formatSignupPhoneNumber('0101234'), '010-1234');
  assert.equal(formatSignupPhoneNumber('01012345678'), '010-1234-5678');
  assert.equal(formatSignupPhoneNumber('010-1234-abcd-5678'), '010-1234-5678');
  assert.equal(formatSignupPhoneNumber('01012345678999'), '010-1234-5678');
});

test('signup panel presents a focused policy experience without post-signup step banners', () => {
  const panelSource = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /signup-form-card/);
  assert.match(panelSource, /signup-referral-note/);
  assert.doesNotMatch(panelSource, /signup-onboarding-strip/);
  assert.doesNotMatch(panelSource, /가입완료/);
  assert.doesNotMatch(panelSource, /구독신청/);
  assert.doesNotMatch(panelSource, /관리자 승인/);
  assert.match(cssSource, /\.signup-form-card/);
  assert.match(cssSource, /\.signup-referral-note/);
  assert.match(cssSource, /\.signup-policy-box details/);
});

test('mock signup rejects duplicate email addresses case-insensitively', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(
    () => registerMockUserAccount(repository, {
      email: 'MEMBER@example.com',
      name: 'Duplicate',
      password: 'Aa1!aaaa',
      createdAt: '2026-05-23T10:00:00.000Z',
    }),
    /Email already registered/,
  );
});
