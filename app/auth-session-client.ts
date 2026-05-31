'use client';

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string;
  profileImageDataUrl?: string | null;
  role: string;
  accountStatus?: string;
};

export type AuthSessionPayload = {
  authenticated: boolean;
  actor?: unknown;
  user?: AuthSessionUser | null;
  message?: string;
};

let cachedAuthSession: AuthSessionPayload | null = null;
let authSessionRequest: Promise<AuthSessionPayload> | null = null;
let authSessionVersion = 0;

export function clearAuthSessionCache(): void {
  authSessionVersion += 1;
  cachedAuthSession = null;
  authSessionRequest = null;
}

export function primeAuthSession(payload: unknown): AuthSessionPayload {
  authSessionVersion += 1;
  cachedAuthSession = normalizeAuthSessionPayload(payload);
  authSessionRequest = null;
  return cachedAuthSession;
}

export function getAuthSession(options: { force?: boolean } = {}): Promise<AuthSessionPayload> {
  if (options.force) {
    authSessionVersion += 1;
    cachedAuthSession = null;
    authSessionRequest = null;
  }

  if (!options.force && cachedAuthSession) {
    return Promise.resolve(cachedAuthSession);
  }

  if (authSessionRequest) {
    return authSessionRequest;
  }

  const requestVersion = authSessionVersion;
  const request = fetch('/api/auth/me', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return createSignedOutSession();
      return normalizeAuthSessionPayload(await response.json().catch(() => ({})));
    })
    .catch(() => createSignedOutSession())
    .then((session) => {
      if (requestVersion !== authSessionVersion) {
        return cachedAuthSession ?? createSignedOutSession();
      }
      cachedAuthSession = session;
      return session;
    })
    .finally(() => {
      if (requestVersion === authSessionVersion && authSessionRequest === request) {
        authSessionRequest = null;
      }
    });

  authSessionRequest = request;
  return request;
}

function createSignedOutSession(): AuthSessionPayload {
  return { authenticated: false, user: null };
}

function normalizeAuthSessionPayload(payload: unknown): AuthSessionPayload {
  if (!isRecord(payload) || !payload.authenticated) {
    return createSignedOutSession();
  }

  return {
    authenticated: true,
    actor: payload.actor,
    user: normalizeAuthSessionUser(payload.user),
    message: typeof payload.message === 'string' ? payload.message : undefined,
  };
}

function normalizeAuthSessionUser(value: unknown): AuthSessionUser | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.role !== 'string'
  ) {
    return null;
  }

  const profileImageDataUrl = normalizeNullableString(value.profileImageDataUrl);
  const accountStatus = typeof value.accountStatus === 'string' ? value.accountStatus : undefined;

  return {
    id: value.id,
    email: value.email,
    name: value.name,
    role: value.role,
    profileImageDataUrl,
    accountStatus,
  };
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
