import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { EmailOutboxRecord } from './repository.ts';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export type EmailDeliveryMessage = {
  id: string;
  from: string;
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
  recordIds?: string[];
};

export type EmailDeliveryRuntimeEnv = {
  NODE_ENV?: string;
  CHART_SERVICE_EMAIL_PROVIDER?: string;
  CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID?: string;
  CHART_SERVICE_CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

export async function deliverQueuedEmailOutbox(
  repository: AsyncChartServiceRepository,
  provider: EmailDeliveryProvider,
  options: EmailOutboxDeliveryOptions,
): Promise<EmailOutboxDeliverySummary> {
  const queued = await repository.listEmailOutboxRecords({ status: 'queued' });
  const eligible = options.recordIds
    ? queued.filter((record) => options.recordIds?.includes(record.id))
    : queued;
  const batch = typeof options.limit === 'number' ? eligible.slice(0, Math.max(0, options.limit)) : eligible;
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
        from: message.from,
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
  if (provider === 'cloudflare') {
    return createCloudflareEmailDeliveryProvider({
      accountId: requireEmailProviderEnv(env, 'CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID'),
      apiToken: requireEmailProviderEnv(env, 'CHART_SERVICE_CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN'),
    });
  }

  throw new Error('Unsupported or missing CHART_SERVICE_EMAIL_PROVIDER. Use "log" or "cloudflare".');
}

export function getEmailDeliveryRuntimeEnv(
  env: EmailDeliveryRuntimeEnv = process.env,
): EmailDeliveryRuntimeEnv {
  const cloudflareEnv = getCloudflareEmailDeliveryEnv();
  return mergeEmailDeliveryRuntimeEnv(env, cloudflareEnv);
}

export function createCloudflareEmailDeliveryProvider(input: {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}): EmailDeliveryProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async sendEmail(message) {
      const response = await fetchImpl(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(input.accountId)}/email/sending/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: message.to,
            from: message.from,
            subject: message.subject,
            text: message.body,
          }),
        },
      );
      const payload = await readCloudflareEmailPayload(response);
      if (!response.ok || payload.success !== true) {
        return {
          ok: false,
          error: formatCloudflareEmailError(payload, response.status),
        };
      }

      return {
        ok: true,
        providerMessageId: readCloudflareProviderMessageId(payload),
      };
    },
  };
}

async function sendEmailSafely(
  provider: EmailDeliveryProvider,
  record: EmailOutboxRecord,
): Promise<EmailDeliveryResult> {
  try {
    return await provider.sendEmail({
      id: record.id,
      from: record.senderEmail,
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

async function readCloudflareEmailPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function formatCloudflareEmailError(payload: Record<string, unknown>, status: number): string {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const messages = errors
    .map((error) => {
      if (!error || typeof error !== 'object') return '';
      const record = error as Record<string, unknown>;
      return typeof record.message === 'string' ? record.message : '';
    })
    .filter(Boolean);
  return messages.length > 0
    ? `Cloudflare Email Sending failed: ${messages.join('; ')}`
    : `Cloudflare Email Sending failed with HTTP ${status}`;
}

function readCloudflareProviderMessageId(payload: Record<string, unknown>): string | null {
  const result = payload.result;
  if (!result || typeof result !== 'object') return null;
  const resultRecord = result as Record<string, unknown>;
  for (const key of ['delivered', 'queued']) {
    const values = resultRecord[key];
    if (Array.isArray(values) && values.length > 0) {
      return `cloudflare:${key}:${String(values[0])}`;
    }
  }
  return null;
}

function requireEmailProviderEnv(
  env: EmailDeliveryRuntimeEnv,
  primaryKey: keyof EmailDeliveryRuntimeEnv,
  fallbackKey: keyof EmailDeliveryRuntimeEnv,
): string {
  const value = env[primaryKey]?.trim() || env[fallbackKey]?.trim();
  if (!value) throw new Error(`${primaryKey} is required for Cloudflare email delivery.`);
  return value;
}

function getCloudflareEmailDeliveryEnv(): EmailDeliveryRuntimeEnv {
  try {
    const context = getCloudflareContext();
    const env = context.env as EmailDeliveryRuntimeEnv;
    return {
      NODE_ENV: env.NODE_ENV,
      CHART_SERVICE_EMAIL_PROVIDER: env.CHART_SERVICE_EMAIL_PROVIDER,
      CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID: env.CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID,
      CHART_SERVICE_CLOUDFLARE_API_TOKEN: env.CHART_SERVICE_CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    };
  } catch {
    return {};
  }
}

function mergeEmailDeliveryRuntimeEnv(
  baseEnv: EmailDeliveryRuntimeEnv,
  overrideEnv: EmailDeliveryRuntimeEnv,
): EmailDeliveryRuntimeEnv {
  const merged: EmailDeliveryRuntimeEnv = { ...baseEnv };
  for (const key of [
    'NODE_ENV',
    'CHART_SERVICE_EMAIL_PROVIDER',
    'CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID',
    'CHART_SERVICE_CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
  ] as const) {
    const value = overrideEnv[key]?.trim();
    if (value) {
      merged[key] = value;
    }
  }
  return merged;
}
