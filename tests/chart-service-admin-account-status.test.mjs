import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getActorFromSession,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAdminUserAccountStatus,
} from '../src/server/chart-service/index.ts';

test('admin can suspend and reactivate a normal user with audit logs', () => {
  const repository = createMockChartServiceRepository();

  const suspended = updateAdminUserAccountStatus(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    accountStatus: 'suspended',
    reason: 'abuse review',
  });
  const reactivated = updateAdminUserAccountStatus(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    accountStatus: 'active',
    reason: 'review cleared',
  });

  assert.equal(suspended.user.accountStatus, 'suspended');
  assert.equal(reactivated.user.accountStatus, 'active');
  assert.equal(repository.listAuditLogs().at(-2)?.action, 'admin.user.account.suspend');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.user.account.activate');
});

test('normal admins cannot suspend admin accounts or themselves', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAdminUserAccountStatus(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'super_1',
    accountStatus: 'suspended',
    reason: 'not allowed',
  }), /Super admin role required/);
  assert.throws(() => updateAdminUserAccountStatus(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'admin_1',
    accountStatus: 'suspended',
    reason: 'self lock',
  }), /Cannot suspend your own account/);
});

test('suspended users cannot create or reuse sessions', () => {
  const repository = createMockChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-23T15:00:00.000Z',
    ttlSeconds: 60 * 60,
  });

  updateAdminUserAccountStatus(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    accountStatus: 'suspended',
    reason: 'security review',
  });

  assert.throws(() => createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: '2026-05-23T15:01:00.000Z',
  }), /Account suspended/);
  assert.throws(() => getActorFromSession(repository, session.id, '2026-05-23T15:02:00.000Z'), /Account suspended/);
  assert.equal(repository.getSessionById(session.id), null);
});

test('admin user detail API can suspend a user and blocks suspended profile access', async () => {
  const repository = getChartServiceRepository();
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const memberSession = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const userRoute = await import('../app/api/admin/users/[id]/route.ts');
  const profileRoute = await import('../app/api/profile/route.ts');

  const updateResponse = await userRoute.PATCH(new Request('http://localhost/api/admin/users/user_member', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ accountStatus: 'suspended', reason: 'risk review' }),
  }), {
    params: Promise.resolve({ id: 'user_member' }),
  });
  const profileResponse = await profileRoute.GET(new Request('http://localhost/api/profile', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberSession.id}` },
  }));
  const payload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(payload.detail.user.accountStatus, 'suspended');
  assert.equal(profileResponse.status, 401);
});

