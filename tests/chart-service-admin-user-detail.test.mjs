import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAuditLogDraft } from '../src/domain/chart-service/index.ts';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  createSupportThread,
  createUserNotification,
  getAdminUserDetail,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAdminUserRole,
} from '../src/server/chart-service/index.ts';

test('admin user detail includes payments, support threads, notifications, and access state', () => {
  const repository = createMockChartServiceRepository();
  createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '입금 확인',
    body: '입금 확인 부탁드립니다.',
    visibility: 'private',
    createdAt: '2026-05-23T15:00:00.000Z',
  });
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'payment',
    title: '결제 대기',
    body: '입금 확인 대기 중입니다.',
    createdAt: '2026-05-23T15:01:00.000Z',
  });

  const detail = getAdminUserDetail(repository, 'user_member');

  assert.equal(detail.user.email, 'member@example.com');
  assert.equal(detail.subscription?.status, 'payment_pending');
  assert.equal(detail.payments.length, 1);
  assert.equal(detail.supportThreads.length, 1);
  assert.equal(detail.notifications.length, 1);
  assert.equal(detail.auditEntries.length, 0);
  assert.equal(detail.access.fullChart, false);
});

test('admin user detail includes related audit entries across user operations', () => {
  const repository = createMockChartServiceRepository();
  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '입금 확인',
    body: '입금 확인 부탁드립니다.',
    visibility: 'private',
    createdAt: '2026-05-23T15:00:00.000Z',
  });

  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: 'user_member',
    beforeJson: { user: { role: 'member' } },
    afterJson: { user: { role: 'subscriber' } },
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'payment.confirm_and_subscription.activate',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: { payment: { status: 'pending' } },
    afterJson: { payment: { status: 'confirmed' } },
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: 'user_trial',
    beforeJson: { user: { role: 'member' } },
    afterJson: { user: { role: 'trial' } },
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'super_1', role: 'super_admin' },
    action: 'subscription.cancel.approve',
    targetType: 'subscription',
    targetId: 'sub_pending',
    beforeJson: { subscription: { status: 'active' } },
    afterJson: { subscription: { status: 'cancelled' }, adminNote: 'manual cancel' },
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'support.reply.created',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread: { status: 'waiting' } },
    afterJson: { thread: { status: 'answered' }, message: { body: '확인했습니다.' } },
  }));

  const detail = getAdminUserDetail(repository, 'user_member');

  assert.deepEqual(
    detail.auditEntries.map((entry) => entry.log.targetId),
    [thread.id, 'sub_pending', 'pay_pending', 'user_member'],
  );
  assert.equal(detail.auditEntries[0].actor?.email, 'admin@example.com');
  assert.equal(detail.auditEntries[1].actor?.email, 'super@example.com');
  assert.equal(detail.auditEntries.some((entry) => entry.log.targetId === 'user_trial'), false);
});

test('admin can update a normal users non-admin role and writes an audit log', () => {
  const repository = createMockChartServiceRepository();

  const result = updateAdminUserRole(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    role: 'salesperson',
  });

  assert.equal(result.user.role, 'salesperson');
  assert.equal(repository.getUserById('user_member')?.role, 'salesperson');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.user.role.update');
});

test('normal admins cannot grant admin roles or modify admin accounts', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAdminUserRole(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'user_member',
    role: 'admin',
  }), /Super admin role required/);
  assert.throws(() => updateAdminUserRole(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    userId: 'super_1',
    role: 'member',
  }), /Super admin role required/);
});

test('super admin can grant admin role through the admin user detail API', async () => {
  const repository = getChartServiceRepository();
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET, PATCH } = await import('../app/api/admin/users/[id]/route.ts');

  const detailResponse = await GET(new Request('http://localhost/api/admin/users/user_member'), {
    params: Promise.resolve({ id: 'user_member' }),
  });
  const detailDeniedPayload = await detailResponse.json();
  const updateResponse = await PATCH(new Request('http://localhost/api/admin/users/user_member', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ role: 'admin' }),
  }), {
    params: Promise.resolve({ id: 'user_member' }),
  });
  const payload = await updateResponse.json();

  assert.equal(detailResponse.status, 401);
  assert.equal(detailDeniedPayload.ok, false);
  assert.equal(updateResponse.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.detail.user.role, 'admin');
});

test('super admin can delete a member through the admin user detail API', async () => {
  const repository = getChartServiceRepository();
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { DELETE } = await import('../app/api/admin/users/[id]/route.ts');

  const response = await DELETE(new Request('http://localhost/api/admin/users/user_subscriber', {
    method: 'DELETE',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
    },
  }), {
    params: Promise.resolve({ id: 'user_subscriber' }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.deletedUserId, 'user_subscriber');
  assert.equal(repository.getUserById('user_subscriber'), null);
});

test('super admin can purge an unverified signup account by email', async () => {
  const repository = getChartServiceRepository();
  const email = `purge-unverified-${Date.now()}@example.com`;
  const userId = repository.nextId('user');
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const member = repository.getUserById('user_member');
  assert.ok(member);
  repository.saveUser({
    ...member,
    id: userId,
    email,
    name: 'Unverified Purge',
    role: 'member',
    referralCode: 'PURGE1',
    referredByUserId: null,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
  });
  repository.saveSession({
    id: repository.nextId('session'),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  repository.saveEmailOutboxRecord({
    id: repository.nextId('email'),
    senderEmail: 'verify@tradingcore.co',
    recipientEmail: email,
    template: 'email_verification',
    subject: 'Verify your TradingCore email',
    body: '/verify-email?token=test',
    status: 'queued',
    createdAt: new Date().toISOString(),
    sentAt: null,
    lastError: null,
  });
  const { DELETE } = await import('../app/api/admin/users/unverified/route.ts');

  const response = await DELETE(new Request('http://localhost/api/admin/users/unverified', {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost',
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.email, email);
  assert.equal(payload.deletedSessionCount, 1);
  assert.equal(payload.deletedEmailOutboxCount, 1);
  assert.equal(repository.getUserByEmail(email), null);
  assert.equal(repository.listSessionsByUserId(userId).length, 0);
  assert.equal(repository.listEmailOutboxRecords().some((record) => record.recipientEmail === email), false);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.user.unverified.purge');
});

test('admin user detail delete API hard purges unverified accounts', async () => {
  const repository = getChartServiceRepository();
  const email = `purge-detail-${Date.now()}@example.com`;
  const userId = repository.nextId('user');
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const member = repository.getUserById('user_member');
  assert.ok(member);
  repository.saveUser({
    ...member,
    id: userId,
    email,
    name: 'Unverified Detail Purge',
    role: 'member',
    referralCode: 'PURGD2',
    referredByUserId: null,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
  });
  const { DELETE } = await import('../app/api/admin/users/[id]/route.ts');

  const response = await DELETE(new Request(`http://localhost/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost',
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
    },
  }), {
    params: Promise.resolve({ id: userId }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.purged, true);
  assert.equal(repository.getUserByEmail(email), null);
});

test('admin user detail delete API can purge a previously disabled unverified test account', async () => {
  const repository = getChartServiceRepository();
  const email = `purge-disabled-${Date.now()}@example.com`;
  const userId = repository.nextId('user');
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const member = repository.getUserById('user_member');
  assert.ok(member);
  repository.saveUser({
    ...member,
    id: userId,
    email,
    name: 'Disabled Unverified Purge',
    role: 'trial',
    accountStatus: 'suspended',
    passwordHash: null,
    referralCode: 'PURGD3',
    referredByUserId: null,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  const { DELETE } = await import('../app/api/admin/users/[id]/route.ts');

  const response = await DELETE(new Request(`http://localhost/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost',
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
    },
  }), {
    params: Promise.resolve({ id: userId }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.purged, true);
  assert.equal(repository.getUserByEmail(email), null);
});

test('unverified purge API refuses verified accounts', async () => {
  const repository = getChartServiceRepository();
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { DELETE } = await import('../app/api/admin/users/unverified/route.ts');

  const response = await DELETE(new Request('http://localhost/api/admin/users/unverified', {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost',
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'member@example.com' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /verified/);
  assert.ok(repository.getUserByEmail('member@example.com'));
});

test('admin user detail delete API retries postgres deadlocks once', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/users/[id]/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /runUserDeleteMutationWithDeadlockRetry/);
  assert.match(routeSource, /isPostgresDeadlockError/);
  assert.match(routeSource, /40P01/);
  assert.match(routeSource, /deadlock detected/);
});
