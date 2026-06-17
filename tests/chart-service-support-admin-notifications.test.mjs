import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdminSupportThreadPath,
  createAsyncChartServiceRepository,
  createAsyncSupportThread,
  createMockChartServiceRepository,
  createSupportThread,
} from '../src/server/chart-service/index.ts';

const CREATED_AT = '2026-05-24T14:00:00.000Z';

test('creating a support thread notifies admins with direct reply links', () => {
  const repository = createMockChartServiceRepository();

  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'usage',
    title: 'Need chart help',
    body: 'Need help reading the signal panel.',
    visibility: 'private',
    createdAt: CREATED_AT,
  });
  const adminLink = createAdminSupportThreadPath(thread.id);

  const adminNotifications = repository.listNotificationsByUserId('admin_1');
  const superAdminNotifications = repository.listNotificationsByUserId('super_1');
  const memberNotifications = repository.listNotificationsByUserId('user_member');
  const queuedEmails = repository.listEmailOutboxRecords({ status: 'queued' });

  assert.equal(adminNotifications.length, 1);
  assert.equal(adminNotifications[0].category, 'support_request');
  assert.equal(adminNotifications[0].linkUrl, adminLink);
  assert.equal(adminNotifications[0].title, 'Need chart help');
  assert.doesNotMatch(adminNotifications[0].title, /New support request/i);
  assert.doesNotMatch(adminNotifications[0].body, /opened a .* request/i);
  assert.equal(adminNotifications[0].body, 'member@example.com: Need help reading the signal panel.');
  assert.match(adminNotifications[0].body, /Need help reading/);
  assert.equal(superAdminNotifications.length, 1);
  assert.equal(superAdminNotifications[0].linkUrl, adminLink);
  assert.equal(memberNotifications.length, 0);
  assert.deepEqual(
    queuedEmails.map((email) => email.recipientEmail).sort(),
    ['admin@example.com', 'super@example.com'],
  );
  assert.deepEqual(new Set(queuedEmails.map((email) => email.template)), new Set(['support_request_admin']));
  assert.ok(queuedEmails.every((email) => email.subject.includes('Need chart help')));
  assert.ok(queuedEmails.every((email) => email.body.includes(adminLink)));
});

test('async support thread creation queues the same admin notification handoff', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());

  const { thread } = await createAsyncSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'signal',
    title: 'Signal subscription question',
    body: 'Please check my signal subscription status.',
    visibility: 'private',
    createdAt: CREATED_AT,
  });
  const adminLink = createAdminSupportThreadPath(thread.id);

  const adminNotifications = await repository.listNotificationsByUserId('admin_1');
  const superAdminNotifications = await repository.listNotificationsByUserId('super_1');
  const queuedEmails = await repository.listEmailOutboxRecords({ status: 'queued' });

  assert.equal(adminNotifications.length, 1);
  assert.equal(adminNotifications[0].category, 'support_request');
  assert.equal(adminNotifications[0].linkUrl, adminLink);
  assert.equal(adminNotifications[0].title, 'Signal subscription question');
  assert.doesNotMatch(adminNotifications[0].title, /New support request/i);
  assert.equal(superAdminNotifications.length, 1);
  assert.deepEqual(
    queuedEmails.map((email) => email.recipientEmail).sort(),
    ['admin@example.com', 'super@example.com'],
  );
  assert.ok(queuedEmails.every((email) => email.body.includes(adminLink)));
});

test('server admin support links match the admin UI direct reply URL format', async () => {
  const { createAdminSupportThreadUrl } = await import('../app/admin/support-thread-links.ts');

  assert.equal(createAdminSupportThreadPath('support_123'), createAdminSupportThreadUrl('support_123'));
  assert.equal(createAdminSupportThreadPath('support 123'), createAdminSupportThreadUrl('support 123'));
});
