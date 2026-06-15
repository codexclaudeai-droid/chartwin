'use client';

export type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

export type NotificationSummaryResult = {
  ok: boolean;
  summary: NotificationSummary | null;
};

export type NotificationListItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type NotificationListResult = {
  ok: boolean;
  notifications: NotificationListItem[];
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

export async function getNotificationList(
  options: { force?: boolean } = {},
): Promise<NotificationListResult> {
  if (options.force) {
    clearNotificationSummaryCache();
  }

  try {
    const response = await fetch('/api/notifications', { cache: 'no-store' });
    if (!response.ok) return createEmptyNotificationList(false);
    return normalizeNotificationListResult(await response.json().catch(() => ({})));
  } catch {
    return createEmptyNotificationList(false);
  }
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

function normalizeNotificationListResult(payload: unknown): NotificationListResult {
  if (!isRecord(payload) || payload.ok !== true || !Array.isArray(payload.notifications)) {
    return createEmptyNotificationList(false);
  }

  return {
    ok: true,
    notifications: payload.notifications
      .map(normalizeNotificationListItem)
      .filter((notification): notification is NotificationListItem => Boolean(notification)),
    summary: normalizeNotificationSummaryFromRecord(payload.summary),
  };
}

function normalizeNotificationListItem(value: unknown): NotificationListItem | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id);
  const category = normalizeRequiredString(value.category);
  const title = normalizeRequiredString(value.title);
  const body = normalizeRequiredString(value.body);
  const createdAt = normalizeRequiredString(value.createdAt);
  if (!id || !category || !title || !createdAt) return null;

  return {
    id,
    category,
    title,
    body,
    linkUrl: normalizeNullableString(value.linkUrl),
    readAt: normalizeNullableString(value.readAt),
    archivedAt: normalizeNullableString(value.archivedAt),
    createdAt,
  };
}

function normalizeNotificationSummaryFromRecord(value: unknown): NotificationSummary | null {
  if (!isRecord(value)) return null;
  const totalCount = Number(value.totalCount);
  const unreadCount = Number(value.unreadCount);
  if (!Number.isFinite(totalCount) || !Number.isFinite(unreadCount)) return null;
  return { totalCount, unreadCount };
}

function createEmptyNotificationList(ok: boolean): NotificationListResult {
  return {
    ok,
    notifications: [],
    summary: null,
  };
}

function normalizeRequiredString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
