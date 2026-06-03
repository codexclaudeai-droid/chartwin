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
  assert.equal(deliveries[0].from, 'noreply@tradingcore.co');
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

test('cloudflare email provider sends queued mail through the Email Sending REST API', async () => {
  const { createCloudflareEmailDeliveryProvider } = await import('../src/server/chart-service/index.ts');
  const requests = [];
  const provider = createCloudflareEmailDeliveryProvider({
    accountId: 'account_123',
    apiToken: 'token_123',
    async fetchImpl(url, init) {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: {
          delivered: ['member@example.com'],
          permanent_bounces: [],
          queued: [],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await provider.sendEmail({
    id: 'email_1',
    from: 'verify@tradingcore.co',
    to: 'member@example.com',
    template: 'email_verification',
    subject: 'Verify your TradingCore email',
    body: 'Verify body',
  });

  assert.deepEqual(result, {
    ok: true,
    providerMessageId: 'cloudflare:delivered:member@example.com',
  });
  assert.equal(requests[0].url, 'https://api.cloudflare.com/client/v4/accounts/account_123/email/sending/send');
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer token_123');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    to: 'member@example.com',
    from: 'verify@tradingcore.co',
    subject: 'Verify your TradingCore email',
    text: 'Verify body',
  });
});

test('cloudflare email provider reports API errors to the outbox dispatcher', async () => {
  const { createCloudflareEmailDeliveryProvider } = await import('../src/server/chart-service/index.ts');
  const provider = createCloudflareEmailDeliveryProvider({
    accountId: 'account_123',
    apiToken: 'token_123',
    async fetchImpl() {
      return new Response(JSON.stringify({
        success: false,
        errors: [{ message: 'sender address is not allowed' }],
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await provider.sendEmail({
    id: 'email_1',
    from: 'verify@tradingcore.co',
    to: 'member@example.com',
    template: 'email_verification',
    subject: 'Verify your TradingCore email',
    body: 'Verify body',
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Cloudflare Email Sending failed: sender address is not allowed',
  });
});

test('email delivery runtime env keeps existing values when Cloudflare bindings are partial', async () => {
  const { getEmailDeliveryRuntimeEnv } = await import('../src/server/chart-service/index.ts');

  const env = getEmailDeliveryRuntimeEnv({
    NODE_ENV: 'production',
    CHART_SERVICE_EMAIL_PROVIDER: 'cloudflare',
    CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID: 'account_123',
    CHART_SERVICE_CLOUDFLARE_API_TOKEN: 'token_123',
  });

  assert.equal(env.CHART_SERVICE_EMAIL_PROVIDER, 'cloudflare');
  assert.equal(env.CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID, 'account_123');
  assert.equal(env.CHART_SERVICE_CLOUDFLARE_API_TOKEN, 'token_123');
});

test('cloudflare email provider env accepts legacy deployment variable names as fallback', async () => {
  const { createEmailDeliveryProviderFromEnv } = await import('../src/server/chart-service/index.ts');

  const provider = createEmailDeliveryProviderFromEnv({
    CHART_SERVICE_EMAIL_PROVIDER: 'cloudflare',
    CLOUDFLARE_ACCOUNT_ID: 'account_123',
    CLOUDFLARE_API_TOKEN: 'token_123',
  });

  assert.equal(typeof provider.sendEmail, 'function');
});

test('email delivery harness is wired into package scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/deliver-email-outbox.mjs', import.meta.url), 'utf8');
  const providerSource = fs.readFileSync(new URL('../src/server/chart-service/email-delivery.ts', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:email:deliver'], 'node scripts/deliver-email-outbox.mjs');
  assert.match(script, /deliverQueuedEmailOutbox/);
  assert.match(script, /createEmailDeliveryProviderFromEnv/);
  assert.match(providerSource, /createLogEmailDeliveryProvider/);
  assert.match(providerSource, /createCloudflareEmailDeliveryProvider/);
});

function createQueuedEmail(id, recipientEmail) {
  return {
    id,
    senderEmail: 'noreply@tradingcore.co',
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
