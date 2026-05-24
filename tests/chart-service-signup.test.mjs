import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  parseSessionCookie,
  registerMockUserAccount,
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
