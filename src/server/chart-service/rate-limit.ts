type RateLimitHeaders = Pick<Headers, 'get'>;

export type RateLimitedRequest = {
  headers: RateLimitHeaders;
  url: string;
};

export type RateLimitOptions = {
  scope?: string;
  limit?: number;
  windowMs?: number;
  nowMs?: number;
};

export type RateLimitDecision = {
  ok: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_MUTATION_LIMIT = 120;
const DEFAULT_MUTATION_WINDOW_MS = 60_000;

const globalForRateLimits = globalThis as typeof globalThis & {
  __chartServiceRateLimitBuckets?: Map<string, RateLimitBucket>;
};

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly limit: number;

  constructor(decision: RateLimitDecision) {
    super('Too many requests');
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = decision.retryAfterSeconds;
    this.limit = decision.limit;
  }
}

export function checkMutationRateLimit(
  request: RateLimitedRequest,
  options: RateLimitOptions = {},
): RateLimitDecision {
  const nowMs = options.nowMs ?? Date.now();
  const policy = resolveMutationRateLimitPolicy(request, options);
  const key = createRateLimitKey(request, policy.scope);
  const buckets = getRateLimitBuckets();
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > nowMs
    ? existing
    : { count: 0, resetAt: nowMs + policy.windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000));
  const remaining = Math.max(0, policy.limit - bucket.count);
  return {
    ok: bucket.count <= policy.limit,
    key,
    limit: policy.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  };
}

export function assertMutationRateLimitRequest(
  request: RateLimitedRequest,
  options: RateLimitOptions = {},
): void {
  const decision = checkMutationRateLimit(request, options);
  if (!decision.ok) {
    throw new RateLimitExceededError(decision);
  }
}

export function isRateLimitExceededError(error: unknown): error is RateLimitExceededError {
  return error instanceof RateLimitExceededError;
}

export function resetChartServiceRateLimits(): void {
  getRateLimitBuckets().clear();
}

function resolveMutationRateLimitPolicy(
  request: RateLimitedRequest,
  options: RateLimitOptions,
): Required<Pick<RateLimitOptions, 'scope' | 'limit' | 'windowMs'>> {
  const pathname = getPathname(request.url);
  if (options.scope && options.limit && options.windowMs) {
    return {
      scope: options.scope,
      limit: options.limit,
      windowMs: options.windowMs,
    };
  }

  if (pathname === '/api/auth/login' || pathname === '/api/auth/signup') {
    return {
      scope: options.scope ?? pathname,
      limit: options.limit ?? 10,
      windowMs: options.windowMs ?? 10 * 60_000,
    };
  }

  if (pathname.startsWith('/api/admin/')) {
    return {
      scope: options.scope ?? pathname,
      limit: options.limit ?? 60,
      windowMs: options.windowMs ?? 60_000,
    };
  }

  if (
    pathname.startsWith('/api/payments/') ||
    pathname.startsWith('/api/subscription/') ||
    pathname.startsWith('/api/support/')
  ) {
    return {
      scope: options.scope ?? pathname,
      limit: options.limit ?? 30,
      windowMs: options.windowMs ?? 60_000,
    };
  }

  return {
    scope: options.scope ?? pathname,
    limit: options.limit ?? DEFAULT_MUTATION_LIMIT,
    windowMs: options.windowMs ?? DEFAULT_MUTATION_WINDOW_MS,
  };
}

function createRateLimitKey(request: RateLimitedRequest, scope: string): string {
  return [
    scope,
    getClientIp(request.headers),
    getSessionKey(request.headers),
  ].join(':');
}

function getClientIp(headers: RateLimitHeaders): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor ||
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'local';
}

function getSessionKey(headers: RateLimitHeaders): string {
  const cookie = headers.get('cookie') ?? '';
  const sessionCookie = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('tc_chart_session='));
  return sessionCookie ? sessionCookie.slice('tc_chart_session='.length) : 'anonymous';
}

function getPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return 'unknown';
  }
}

function getRateLimitBuckets(): Map<string, RateLimitBucket> {
  globalForRateLimits.__chartServiceRateLimitBuckets ??= new Map();
  return globalForRateLimits.__chartServiceRateLimitBuckets;
}
