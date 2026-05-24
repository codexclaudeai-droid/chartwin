import type {
  Actor,
  NotificationCategory,
  NotificationRecord,
} from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository } from './repository.ts';

export { formatNotificationBadgeCount } from '../../domain/chart-service/notifications.ts';

export function createUserNotification(
  repository: ChartServiceRepository,
  input: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    linkUrl?: string | null;
    createdAt: string;
  },
): NotificationRecord {
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);

  const notification: NotificationRecord = {
    id: repository.nextId('notification'),
    userId: input.userId,
    category: input.category,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl ?? null,
    readAt: null,
    createdAt: input.createdAt,
  };
  repository.saveNotification(notification);
  return notification;
}

export function listNotificationsForUser(
  repository: ChartServiceRepository,
  input: { actor: Actor },
): NotificationRecord[] {
  return repository
    .listNotificationsByUserId(input.actor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getNotificationSummaryForUser(
  repository: ChartServiceRepository,
  input: { actor: Actor },
): { totalCount: number; unreadCount: number } {
  const notifications = repository.listNotificationsByUserId(input.actor.id);
  return {
    totalCount: notifications.length,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  };
}

export function markNotificationReadForUser(
  repository: ChartServiceRepository,
  input: { actor: Actor; notificationId: string; readAt: string },
): NotificationRecord {
  const notification = repository
    .listNotificationsByUserId(input.actor.id)
    .find((item) => item.id === input.notificationId);
  if (!notification) {
    throw new Error(`Notification not found: ${input.notificationId}`);
  }

  const readNotification = {
    ...notification,
    readAt: notification.readAt ?? input.readAt,
  };
  repository.saveNotification(readNotification);
  return readNotification;
}

export function markAllNotificationsReadForUser(
  repository: ChartServiceRepository,
  input: { actor: Actor; readAt: string },
): { updatedCount: number } {
  const unreadNotifications = repository
    .listNotificationsByUserId(input.actor.id)
    .filter((notification) => !notification.readAt);

  unreadNotifications.forEach((notification) => {
    repository.saveNotification({
      ...notification,
      readAt: input.readAt,
    });
  });

  return { updatedCount: unreadNotifications.length };
}
