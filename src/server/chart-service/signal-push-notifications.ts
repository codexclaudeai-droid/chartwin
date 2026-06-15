import {
  SUBSCRIPTION_STATUSES,
  USER_ACCOUNT_STATUSES,
  type NotificationRecord,
  type SubscriptionRecord,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ServiceUserRecord } from './repository.ts';
import {
  notifyUserPushSubscriptions,
  type WebPushDeliverySummary,
} from './web-push.ts';
import type { TelegramSignalEvent } from './telegram-alerts.ts';

export type SignalPushNotificationResult = {
  eligibleUserCount: number;
  notificationCount: number;
  pushConfigured: boolean;
  pushAttemptedCount: number;
  pushDeliveredCount: number;
  pushRemovedCount: number;
  pushFailedCount: number;
};

type SignalPushOptions = {
  webPush?: Parameters<typeof notifyUserPushSubscriptions>[2];
};

const SIGNAL_NOTIFICATION_LINK = '/chart';

export async function notifyAsyncSignalPushSubscribers(
  repository: AsyncChartServiceRepository,
  event: TelegramSignalEvent,
  options: SignalPushOptions = {},
): Promise<SignalPushNotificationResult> {
  if (event.eventType !== 'buy' && event.eventType !== 'sell') {
    return createEmptySignalPushNotificationResult(false);
  }

  const [users, subscriptions] = await Promise.all([
    repository.listUsers(),
    repository.listSubscriptions(),
  ]);
  const eligibleUsers = getEligibleSignalPushUsers(users, subscriptions, event.occurredAt);
  const result = createEmptySignalPushNotificationResult(false);
  result.eligibleUserCount = eligibleUsers.length;

  for (const user of eligibleUsers) {
    const notification = await createAsyncSignalNotification(repository, user, event);
    result.notificationCount += 1;

    try {
      mergeWebPushSummary(
        result,
        await notifyUserPushSubscriptions(repository, notification, options.webPush),
      );
    } catch {
      result.pushFailedCount += 1;
    }
  }

  return result;
}

export function getEligibleSignalPushUsers(
  users: ServiceUserRecord[],
  subscriptions: SubscriptionRecord[],
  nowIso: string,
): ServiceUserRecord[] {
  const nowMs = readFiniteTime(nowIso) ?? Date.now();
  const eligibleUserIds = new Set(
    subscriptions
      .filter((subscription) => isSignalPushEligibleSubscription(subscription, nowMs))
      .map((subscription) => subscription.userId),
  );

  return users
    .filter((user) => user.accountStatus === USER_ACCOUNT_STATUSES.active)
    .filter((user) => eligibleUserIds.has(user.id))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function isSignalPushEligibleSubscription(subscription: SubscriptionRecord, nowMs: number): boolean {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.trialActive &&
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring
  ) {
    return false;
  }

  const startsAtMs = readFiniteTime(subscription.startsAt);
  if (startsAtMs != null && startsAtMs > nowMs) return false;

  const endsAtMs = readFiniteTime(subscription.endsAt);
  return endsAtMs == null || endsAtMs > nowMs;
}

async function createAsyncSignalNotification(
  repository: AsyncChartServiceRepository,
  user: ServiceUserRecord,
  event: TelegramSignalEvent,
): Promise<NotificationRecord> {
  const notification: NotificationRecord = {
    id: await repository.nextId('notification'),
    userId: user.id,
    category: 'signal',
    title: formatSignalNotificationTitle(event),
    body: formatSignalNotificationBody(event),
    linkUrl: SIGNAL_NOTIFICATION_LINK,
    readAt: null,
    archivedAt: null,
    createdAt: event.occurredAt,
  };
  await repository.saveNotification(notification);
  return notification;
}

function formatSignalNotificationTitle(event: TelegramSignalEvent): string {
  return event.eventType === 'sell' ? '매도신호발생' : '매수신호발생';
}

function formatSignalNotificationBody(event: TelegramSignalEvent): string {
  const parts = [
    event.symbolId.trim().toUpperCase(),
    event.timeframe?.trim() || null,
    typeof event.price === 'number' && Number.isFinite(event.price) ? formatSignalPrice(event.price) : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatSignalPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : String(Number(price.toFixed(8)));
}

function mergeWebPushSummary(
  result: SignalPushNotificationResult,
  summary: WebPushDeliverySummary,
): void {
  result.pushConfigured = result.pushConfigured || summary.configured;
  result.pushAttemptedCount += summary.attempted;
  result.pushDeliveredCount += summary.delivered;
  result.pushRemovedCount += summary.removed;
  result.pushFailedCount += summary.failed;
}

function createEmptySignalPushNotificationResult(pushConfigured: boolean): SignalPushNotificationResult {
  return {
    eligibleUserCount: 0,
    notificationCount: 0,
    pushConfigured,
    pushAttemptedCount: 0,
    pushDeliveredCount: 0,
    pushRemovedCount: 0,
    pushFailedCount: 0,
  };
}

function readFiniteTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}
