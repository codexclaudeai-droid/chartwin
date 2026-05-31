import assert from 'node:assert/strict';
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
  assert.equal(repository.getUserById('user_subscriber')?.passwordHash, null);
});
