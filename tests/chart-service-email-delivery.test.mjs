import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  createMockChartServiceState,
} from '../src/server/chart-service/index.ts';

const NOW = '2026-05-24T14:00:00.000Z';

test('email outbox dispatcher marks delivered queued mail as sent', async () => {
  const { deliverQueuedEmailOutbox } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));
  const deliveries = [];

  await repository.saveEmailOutboxRecord(createQueuedEmail('email_1', 'member@example.com'));
  await repository.saveEmailOutboxRecord(createQueuedEmail('email_2', 'admin@example.com'));

  const summary = await deliverQueuedEmailOutbox(repository, {
    async sendEmail(message) {
      deliveries.push(message);
      return { ok: true, providerMessageId: `mock_${message.id}` };
    },
  }, {
    deliveredAt: NOW,
    limit: 1,
  });
  const sent = await repository.listEmailOutboxRecords({ status: 'sent' });
  const queued = await repository.listEmailOutboxRecords({ status: 'queued' });

  assert.deepEqual(summary, {
    processed: 1,
    sent: 1,
    failed: 0,
    remainingQueued: 1,
  });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, 'member@example.com');
  assert.equal(sent[0].id, 'email_1');
  assert.equal(sent[0].sentAt, NOW);
  assert.equal(sent[0].lastError, null);
  assert.deepEqual(queued.map((email) => email.id), ['email_2']);
});

test('email outbox dispatcher marks provider failures without stopping the batch', async () => {
  const { deliverQueuedEmailOutbox } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  await repository.saveEmailOutboxRecord(createQueuedEmail('email_1', 'member@example.com'));
  await repository.saveEmailOutboxRecord(createQueuedEmail('email_2', 'admin@example.com'));

  const summary = await deliverQueuedEmailOutbox(repository, {
    async sendEmail(message) {
      if (message.id === 'email_1') {
        return { ok: false, error: 'provider rejected recipient' };
      }
      return { ok: true, providerMessageId: `mock_${message.id}` };
    },
  }, {
    deliveredAt: NOW,
  });
  const sent = await repository.listEmailOutboxRecords({ status: 'sent' });
  const failed = await repository.listEmailOutboxRecords({ status: 'failed' });

  assert.deepEqual(summary, {
    processed: 2,
    sent: 1,
    failed: 1,
    remainingQueued: 0,
  });
  assert.deepEqual(sent.map((email) => email.id), ['email_2']);
  assert.equal(failed[0].id, 'email_1');
  assert.match(failed[0].lastError, /provider rejected recipient/);
});

test('email delivery harness is wired into package scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/deliver-email-outbox.mjs', import.meta.url), 'utf8');
  const providerSource = fs.readFileSync(new URL('../src/server/chart-service/email-delivery.ts', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:email:deliver'], 'node scripts/deliver-email-outbox.mjs');
  assert.match(script, /deliverQueuedEmailOutbox/);
  assert.match(script, /createEmailDeliveryProviderFromEnv/);
  assert.match(providerSource, /createLogEmailDeliveryProvider/);
});

function createQueuedEmail(id, recipientEmail) {
  return {
    id,
    recipientEmail,
    template: 'password_reset',
    subject: 'Reset password',
    body: 'Body',
    status: 'queued',
    createdAt: NOW,
    sentAt: null,
    lastError: null,
  };
}
