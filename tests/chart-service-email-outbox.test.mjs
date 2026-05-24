import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  createMockChartServiceState,
} from '../src/server/chart-service/index.ts';

const NOW = '2026-05-24T13:00:00.000Z';

test('password reset request queues a transactional email without exposing unknown accounts', async () => {
  const { requestAsyncPasswordReset } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  const existing = await requestAsyncPasswordReset(repository, {
    email: 'member@example.com',
    requestedAt: NOW,
    token: 'email-outbox-token',
  });
  const unknown = await requestAsyncPasswordReset(repository, {
    email: 'nobody@example.com',
    requestedAt: NOW,
    token: 'unknown-token',
  });
  const emails = await repository.listEmailOutboxRecords({ status: 'queued' });

  assert.equal(existing.emailOutboxId, emails[0].id);
  assert.equal(unknown.emailOutboxId, null);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].recipientEmail, 'member@example.com');
  assert.equal(emails[0].template, 'password_reset');
  assert.equal(emails[0].status, 'queued');
  assert.match(emails[0].subject, /password/i);
  assert.match(emails[0].body, /email-outbox-token/);
  assert.match(emails[0].body, /expires/i);
});

test('email outbox repository can list queued records and update delivery status', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  await repository.saveEmailOutboxRecord({
    id: 'email_1',
    recipientEmail: 'member@example.com',
    template: 'password_reset',
    subject: 'Reset password',
    body: 'Body',
    status: 'queued',
    createdAt: NOW,
    sentAt: null,
    lastError: null,
  });
  await repository.saveEmailOutboxRecord({
    id: 'email_2',
    recipientEmail: 'admin@example.com',
    template: 'admin_notice',
    subject: 'Notice',
    body: 'Body',
    status: 'sent',
    createdAt: NOW,
    sentAt: NOW,
    lastError: null,
  });
  await repository.saveEmailOutboxRecord({
    id: 'email_1',
    recipientEmail: 'member@example.com',
    template: 'password_reset',
    subject: 'Reset password',
    body: 'Body',
    status: 'sent',
    createdAt: NOW,
    sentAt: '2026-05-24T13:01:00.000Z',
    lastError: null,
  });

  const queued = await repository.listEmailOutboxRecords({ status: 'queued' });
  const sent = await repository.listEmailOutboxRecords({ status: 'sent' });

  assert.deepEqual(queued, []);
  assert.deepEqual(sent.map((email) => email.id).sort(), ['email_1', 'email_2']);
  assert.equal(sent.find((email) => email.id === 'email_1')?.sentAt, '2026-05-24T13:01:00.000Z');
});

