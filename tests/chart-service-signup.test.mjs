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

test('signup panel captures referral codes from the signup URL', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /searchParams\.get\('ref'\)/);
  assert.match(source, /referralCode/);
  assert.match(source, /signupReferralCode/);
  assert.match(source, /추천코드/);
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

  assert.match(source, /signupPhoneNumber/);
  assert.match(source, /phoneNumber/);
  assert.match(source, /signupPasswordConfirm/);
  assert.match(source, /passwordConfirm/);
  assert.match(source, /acceptedTerms/);
  assert.match(source, /acceptedPrivacy/);
  assert.match(source, /signupTermsAgreement/);
  assert.match(source, /signupPrivacyAgreement/);
  assert.match(source, /<details/);
  assert.match(source, /\/api\/web-info/);
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
