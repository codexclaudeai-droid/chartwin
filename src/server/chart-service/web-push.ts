import type { Actor, NotificationRecord } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, PushSubscriptionRecord } from './repository.ts';

export type BrowserPushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export type WebPushDeliverySummary = {
  configured: boolean;
  attempted: number;
  delivered: number;
  removed: number;
  failed: number;
};

type WebPushEnvironment = Record<string, string | undefined>;

type WebPushSendOptions = {
  env?: WebPushEnvironment;
  fetch?: typeof fetch;
  now?: Date;
  ttlSeconds?: number;
};

export function getWebPushPublicKey(env: WebPushEnvironment = getRuntimeEnv()): string | null {
  const value = env.WEB_PUSH_PUBLIC_KEY ?? env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? null;
  return normalizeOptionalString(value);
}

export function isWebPushConfigured(env: WebPushEnvironment = getRuntimeEnv()): boolean {
  return Boolean(
    getWebPushPublicKey(env) &&
    normalizeOptionalString(env.WEB_PUSH_PRIVATE_KEY) &&
    normalizeOptionalString(env.WEB_PUSH_SUBJECT),
  );
}

export function registerPushSubscriptionForUser(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    subscription: BrowserPushSubscriptionInput;
    userAgent?: string | null;
    now?: string;
  },
): PushSubscriptionRecord {
  const endpoint = normalizeRequiredString(input.subscription.endpoint, 'push endpoint');
  const p256dh = normalizeRequiredString(input.subscription.keys?.p256dh, 'push p256dh key');
  const auth = normalizeRequiredString(input.subscription.keys?.auth, 'push auth key');
  const now = input.now ?? new Date().toISOString();
  const existing = repository
    .listPushSubscriptionsByUserId(input.actor.id)
    .find((subscription) => subscription.endpoint === endpoint);
  const record = createPushSubscriptionRecord({
    endpoint,
    userId: input.actor.id,
    p256dh,
    auth,
    expirationTime: input.subscription.expirationTime,
    userAgent: input.userAgent,
    now,
    existing,
  });

  repository.savePushSubscription(record);
  return { ...record };
}

export async function registerPushSubscriptionForUserAsync(
  repository: AsyncChartServiceRepository,
  input: {
    actor: Actor;
    subscription: BrowserPushSubscriptionInput;
    userAgent?: string | null;
    now?: string;
  },
): Promise<PushSubscriptionRecord> {
  const endpoint = normalizeRequiredString(input.subscription.endpoint, 'push endpoint');
  const p256dh = normalizeRequiredString(input.subscription.keys?.p256dh, 'push p256dh key');
  const auth = normalizeRequiredString(input.subscription.keys?.auth, 'push auth key');
  const now = input.now ?? new Date().toISOString();
  const existing = (await repository.listPushSubscriptionsByUserId(input.actor.id))
    .find((subscription) => subscription.endpoint === endpoint);
  const record = createPushSubscriptionRecord({
    endpoint,
    userId: input.actor.id,
    p256dh,
    auth,
    expirationTime: input.subscription.expirationTime,
    userAgent: input.userAgent,
    now,
    existing,
  });

  await repository.savePushSubscription(record);
  return { ...record };
}

export function unregisterPushSubscriptionForUser(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    endpoint: string;
  },
): boolean {
  const endpoint = normalizeRequiredString(input.endpoint, 'push endpoint');
  const exists = repository
    .listPushSubscriptionsByUserId(input.actor.id)
    .some((subscription) => subscription.endpoint === endpoint);

  repository.deletePushSubscription(input.actor.id, endpoint);
  return exists;
}

export async function unregisterPushSubscriptionForUserAsync(
  repository: AsyncChartServiceRepository,
  input: {
    actor: Actor;
    endpoint: string;
  },
): Promise<boolean> {
  const endpoint = normalizeRequiredString(input.endpoint, 'push endpoint');
  const exists = (await repository.listPushSubscriptionsByUserId(input.actor.id))
    .some((subscription) => subscription.endpoint === endpoint);

  await repository.deletePushSubscription(input.actor.id, endpoint);
  return exists;
}

export async function notifyUserPushSubscriptions(
  repository: AsyncChartServiceRepository,
  notification: NotificationRecord,
  options: WebPushSendOptions = {},
): Promise<WebPushDeliverySummary> {
  const env = options.env ?? getRuntimeEnv();
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const configured = isWebPushConfigured(env);
  const summary: WebPushDeliverySummary = {
    configured,
    attempted: 0,
    delivered: 0,
    removed: 0,
    failed: 0,
  };

  if (!configured || typeof fetchImpl !== 'function') {
    return summary;
  }

  const subscriptions = await repository.listPushSubscriptionsByUserId(notification.userId);
  for (const subscription of subscriptions) {
    summary.attempted += 1;
    try {
      const delivery = await sendWebPushPing(subscription, {
        env,
        fetch: fetchImpl,
        now: options.now,
        ttlSeconds: options.ttlSeconds,
      });
      if (delivery === 'gone') {
        await repository.deletePushSubscription(subscription.userId, subscription.endpoint);
        summary.removed += 1;
      } else {
        summary.delivered += 1;
      }
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

async function sendWebPushPing(
  subscription: PushSubscriptionRecord,
  options: Required<Pick<WebPushSendOptions, 'env' | 'fetch'>> & Pick<WebPushSendOptions, 'now' | 'ttlSeconds'>,
): Promise<'sent' | 'gone'> {
  const publicKey = getWebPushPublicKey(options.env);
  const privateKey = normalizeOptionalString(options.env.WEB_PUSH_PRIVATE_KEY);
  const subject = normalizeOptionalString(options.env.WEB_PUSH_SUBJECT);
  if (!publicKey || !privateKey || !subject) return 'sent';

  const audience = new URL(subscription.endpoint).origin;
  const token = await createVapidJwt({
    audience,
    publicKey,
    privateKey,
    subject,
    now: options.now ?? new Date(),
  });
  const response = await options.fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${publicKey}`,
      TTL: String(options.ttlSeconds ?? 60),
    },
  });

  if (response.status === 404 || response.status === 410) return 'gone';
  if (!response.ok) throw new Error(`Web Push delivery failed: ${response.status}`);
  return 'sent';
}

async function createVapidJwt(input: {
  audience: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  now: Date;
}): Promise<string> {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('WebCrypto is required for Web Push VAPID signing');

  const header = encodeBase64UrlJson({ alg: 'ES256', typ: 'JWT' });
  const payload = encodeBase64UrlJson({
    aud: input.audience,
    exp: Math.floor(input.now.getTime() / 1000) + (12 * 60 * 60),
    sub: input.subject,
  });
  const signingInput = `${header}.${payload}`;
  const key = await importVapidPrivateKey(input.publicKey, input.privateKey);
  const signature = await cryptoImpl.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(normalizeEcdsaSignature(new Uint8Array(signature)))}`;
}

async function importVapidPrivateKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const publicBytes = base64UrlDecode(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error('WEB_PUSH_PUBLIC_KEY must be an uncompressed P-256 public key');
  }

  return await globalThis.crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(publicBytes.slice(1, 33)),
      y: base64UrlEncode(publicBytes.slice(33, 65)),
      d: base64UrlEncode(base64UrlDecode(privateKey)),
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

function normalizeEcdsaSignature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) return signature;
  if (signature[0] !== 0x30) return signature;

  let offset = 2;
  if (signature[1] & 0x80) {
    offset = 2 + (signature[1] & 0x7f);
  }
  if (signature[offset] !== 0x02) return signature;
  const rLength = signature[offset + 1];
  const r = signature.slice(offset + 2, offset + 2 + rLength);
  offset += 2 + rLength;
  if (signature[offset] !== 0x02) return signature;
  const sLength = signature[offset + 1];
  const s = signature.slice(offset + 2, offset + 2 + sLength);

  return concatFixedInteger(r, s);
}

function concatFixedInteger(r: Uint8Array, s: Uint8Array): Uint8Array {
  const output = new Uint8Array(64);
  output.set(trimInteger(r).slice(-32), 32 - Math.min(trimInteger(r).length, 32));
  output.set(trimInteger(s).slice(-32), 64 - Math.min(trimInteger(s).length, 32));
  return output;
}

function trimInteger(value: Uint8Array): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  return value.slice(start);
}

function encodeBase64UrlJson(value: Record<string, unknown>): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncode(value: Uint8Array): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return new Uint8Array(Buffer.from(`${normalized}${padding}`, 'base64'));
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing ${fieldName}`);
  }
  return value.trim();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizeExpirationTime(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeUserAgent(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.slice(0, 500) : null;
}

function getRuntimeEnv(): WebPushEnvironment {
  return typeof process === 'undefined' ? {} : process.env;
}

function createPushSubscriptionRecord(input: {
  endpoint: string;
  userId: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null | undefined;
  userAgent: string | null | undefined;
  now: string;
  existing: PushSubscriptionRecord | undefined;
}): PushSubscriptionRecord {
  return {
    endpoint: input.endpoint,
    userId: input.userId,
    p256dh: input.p256dh,
    auth: input.auth,
    expirationTime: normalizeExpirationTime(input.expirationTime),
    userAgent: normalizeUserAgent(input.userAgent),
    createdAt: input.existing?.createdAt ?? input.now,
    updatedAt: input.now,
  };
}
