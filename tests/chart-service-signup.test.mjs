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
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.email, 'new@example.com');
  assert.equal(result.user.role, 'member');
  assert.equal(result.user.passwordHash?.includes('Aa1!aaaa'), false);
  assert.match(result.user.passwordHash ?? '', /^pbkdf2_sha256\$/);
  assert.match(result.cookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.equal(parseSessionCookie(result.cookie), result.session.id);
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
    referralCode: referrer?.referralCode,
    createdAt: '2026-05-23T10:00:00.000Z',
  });

  assert.equal(result.user.referredByUserId, 'user_subscriber');
  assert.equal(syncRepository.getUserByEmail('async-referred@example.com')?.referredByUserId, 'user_subscriber');
});

test('signup API stores the referrer from a referral code', async () => {
  const { POST } = await import('../app/api/auth/signup/route.ts');

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
      referralCode: 'TC-USERSUBSCRIBER',
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.user.referredByUserId, 'user_subscriber');
});

test('signup panel captures referral codes from the signup URL', () => {
  const source = readFileSync(new URL('../app/signup/signup-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /searchParams\.get\('ref'\)/);
  assert.match(source, /referralCode/);
  assert.match(source, /signupReferralCode/);
  assert.match(source, /추천코드/);
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
