import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { EmailOutboxRecord } from './repository.ts';

export type EmailDeliveryMessage = {
  id: string;
  to: string;
  template: string;
  subject: string;
  body: string;
};

export type EmailDeliveryResult = {
  ok: true;
  providerMessageId?: string | null;
} | {
  ok: false;
  error: string;
};

export type EmailDeliveryProvider = {
  sendEmail(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>;
};

export type EmailOutboxDeliverySummary = {
  processed: number;
  sent: number;
  failed: number;
  remainingQueued: number;
};

export type EmailOutboxDeliveryOptions = {
  deliveredAt: string;
  limit?: number;
};

export type EmailDeliveryRuntimeEnv = {
  NODE_ENV?: string;
  CHART_SERVICE_EMAIL_PROVIDER?: string;
};

export async function deliverQueuedEmailOutbox(
  repository: AsyncChartServiceRepository,
  provider: EmailDeliveryProvider,
  options: EmailOutboxDeliveryOptions,
): Promise<EmailOutboxDeliverySummary> {
  const queued = await repository.listEmailOutboxRecords({ status: 'queued' });
  const batch = typeof options.limit === 'number' ? queued.slice(0, Math.max(0, options.limit)) : queued;
  let sent = 0;
  let failed = 0;

  for (const record of batch) {
    const result = await sendEmailSafely(provider, record);
    if (result.ok === false) {
      failed += 1;
      await repository.saveEmailOutboxRecord({
        ...record,
        status: 'failed',
        sentAt: null,
        lastError: result.error,
      });
      continue;
    }

    sent += 1;
    await repository.saveEmailOutboxRecord({
      ...record,
      status: 'sent',
      sentAt: options.deliveredAt,
      lastError: null,
    });
  }

  return {
    processed: batch.length,
    sent,
    failed,
    remainingQueued: (await repository.listEmailOutboxRecords({ status: 'queued' })).length,
  };
}

export function createLogEmailDeliveryProvider(
  write: (line: string) => void = console.log,
): EmailDeliveryProvider {
  return {
    async sendEmail(message) {
      write(JSON.stringify({
        type: 'chart-service.email.delivery',
        id: message.id,
        to: message.to,
        template: message.template,
        subject: message.subject,
      }));
      return {
        ok: true,
        providerMessageId: `log:${message.id}`,
      };
    },
  };
}

export function createEmailDeliveryProviderFromEnv(
  env: EmailDeliveryRuntimeEnv,
  write: (line: string) => void = console.log,
): EmailDeliveryProvider {
  const provider = (env.CHART_SERVICE_EMAIL_PROVIDER || (env.NODE_ENV === 'production' ? '' : 'log')).trim().toLowerCase();
  if (provider === 'log') {
    return createLogEmailDeliveryProvider(write);
  }

  throw new Error('Unsupported or missing CHART_SERVICE_EMAIL_PROVIDER. Use "log" for the current delivery harness.');
}

async function sendEmailSafely(
  provider: EmailDeliveryProvider,
  record: EmailOutboxRecord,
): Promise<EmailDeliveryResult> {
  try {
    return await provider.sendEmail({
      id: record.id,
      to: record.recipientEmail,
      template: record.template,
      subject: record.subject,
      body: record.body,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email delivery error',
    };
  }
}
