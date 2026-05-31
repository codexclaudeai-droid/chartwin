'use client';

export type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

export type NotificationSummaryResult = {
  ok: boolean;
  summary: NotificationSummary | null;
};

const NOTIFICATION_SUMMARY_CACHE_TTL_MS = 5 * 1000;

let cachedNotificationSummary: NotificationSummaryResult | null = null;
let cachedNotificationSummaryAt = 0;
let notificationSummaryRequest: Promise<NotificationSummaryResult> | null = null;
let notificationSummaryVersion = 0;

export function clearNotificationSummaryCache(): void {
  notificationSummaryVersion += 1;
  cachedNotificationSummary = null;
  cachedNotificationSummaryAt = 0;
  notificationSummaryRequest = null;
}

export function getNotificationSummary(
  options: { force?: boolean } = {},
): Promise<NotificationSummaryResult> {
  if (options.force) {
    clearNotificationSummaryCache();
  }

  const now = Date.now();
  if (
    cachedNotificationSummary &&
    now - cachedNotificationSummaryAt < NOTIFICATION_SUMMARY_CACHE_TTL_MS
  ) {
    return Promise.resolve(cachedNotificationSummary);
  }

  if (notificationSummaryRequest) {
    return notificationSummaryRequest;
  }

  const requestVersion = notificationSummaryVersion;
  const request = fetch('/api/notifications?summary=1', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return createEmptyNotificationSummary(false);
      return normalizeNotificationSummaryResult(await response.json().catch(() => ({})));
    })
    .catch(() => createEmptyNotificationSummary(false))
    .then((result) => {
      if (requestVersion !== notificationSummaryVersion) {
        return cachedNotificationSummary ?? createEmptyNotificationSummary(false);
      }
      cachedNotificationSummary = result;
      cachedNotificationSummaryAt = Date.now();
      return result;
    })
    .finally(() => {
      if (requestVersion === notificationSummaryVersion && notificationSummaryRequest === request) {
        notificationSummaryRequest = null;
      }
    });

  notificationSummaryRequest = request;
  return request;
}

function normalizeNotificationSummaryResult(payload: unknown): NotificationSummaryResult {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.summary)) {
    return createEmptyNotificationSummary(false);
  }

  const totalCount = Number(payload.summary.totalCount);
  const unreadCount = Number(payload.summary.unreadCount);
  if (!Number.isFinite(totalCount) || !Number.isFinite(unreadCount)) {
    return createEmptyNotificationSummary(false);
  }

  return {
    ok: true,
    summary: {
      totalCount,
      unreadCount,
    },
  };
}

function createEmptyNotificationSummary(ok: boolean): NotificationSummaryResult {
  return {
    ok,
    summary: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
