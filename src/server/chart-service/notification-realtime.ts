import type { NotificationRecord } from '../../domain/chart-service/index.ts';

export type NotificationRealtimeEvent = {
  type: 'notifications.changed';
  userId: string;
  notificationId: string;
  emittedAt: string;
};

export type NotificationRealtimeStreamOptions = {
  heartbeatMs?: number | null;
  now?: () => string;
  signal?: AbortSignal;
};

type NotificationRealtimeSubscriber = {
  send: (eventName: string, payload: Record<string, unknown>) => boolean;
  close: () => void;
};

const DEFAULT_HEARTBEAT_MS = 25 * 1000;
const notificationSubscribersByUserId = new Map<string, Set<NotificationRealtimeSubscriber>>();
const textEncoder = new TextEncoder();

export function createNotificationRealtimeStream(
  userId: string,
  options: NotificationRealtimeStreamOptions = {},
): ReadableStream<Uint8Array> {
  const heartbeatMs = options.heartbeatMs === undefined ? DEFAULT_HEARTBEAT_MS : options.heartbeatMs;
  const now = options.now ?? (() => new Date().toISOString());
  let cleanup: () => void = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;
      let heartbeatId: ReturnType<typeof setInterval> | null = null;

      const subscriber: NotificationRealtimeSubscriber = {
        send(eventName, payload) {
          if (isClosed) return false;
          try {
            controller.enqueue(encodeSseEvent(eventName, payload));
            return true;
          } catch {
            cleanup();
            return false;
          }
        },
        close() {
          cleanup();
        },
      };

      cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (heartbeatId) clearInterval(heartbeatId);
        options.signal?.removeEventListener('abort', cleanup);
        unregisterNotificationRealtimeSubscriber(userId, subscriber);
        try {
          controller.close();
        } catch {
          // The stream may already be canceled by the client.
        }
      };

      registerNotificationRealtimeSubscriber(userId, subscriber);
      options.signal?.addEventListener('abort', cleanup, { once: true });
      controller.enqueue(textEncoder.encode('retry: 5000\n\n'));
      subscriber.send('notifications.ready', {
        type: 'notifications.ready',
        emittedAt: now(),
      });

      if (heartbeatMs !== null && heartbeatMs > 0) {
        heartbeatId = setInterval(() => {
          if (!subscriber.send('notifications.heartbeat', {
            type: 'notifications.heartbeat',
            emittedAt: now(),
          })) {
            cleanup();
          }
        }, heartbeatMs);
      }
    },
    cancel() {
      cleanup();
    },
  });
}

export function publishNotificationRealtimeEvent(input: {
  userId: string;
  notificationId: string;
  emittedAt?: string;
}): number {
  const subscribers = notificationSubscribersByUserId.get(input.userId);
  if (!subscribers || subscribers.size === 0) return 0;

  const event: NotificationRealtimeEvent = {
    type: 'notifications.changed',
    userId: input.userId,
    notificationId: input.notificationId,
    emittedAt: input.emittedAt ?? new Date().toISOString(),
  };

  let deliveredCount = 0;
  for (const subscriber of [...subscribers]) {
    if (subscriber.send('notifications.changed', event)) {
      deliveredCount += 1;
    } else {
      unregisterNotificationRealtimeSubscriber(input.userId, subscriber);
    }
  }
  return deliveredCount;
}

export function publishNotificationRecordRealtimeEvent(notification: NotificationRecord): number {
  return publishNotificationRealtimeEvent({
    userId: notification.userId,
    notificationId: notification.id,
  });
}

export function getNotificationRealtimeSubscriberCount(userId: string): number {
  return notificationSubscribersByUserId.get(userId)?.size ?? 0;
}

function registerNotificationRealtimeSubscriber(
  userId: string,
  subscriber: NotificationRealtimeSubscriber,
): void {
  const subscribers = notificationSubscribersByUserId.get(userId) ?? new Set<NotificationRealtimeSubscriber>();
  subscribers.add(subscriber);
  notificationSubscribersByUserId.set(userId, subscribers);
}

function unregisterNotificationRealtimeSubscriber(
  userId: string,
  subscriber: NotificationRealtimeSubscriber,
): void {
  const subscribers = notificationSubscribersByUserId.get(userId);
  if (!subscribers) return;
  subscribers.delete(subscriber);
  if (subscribers.size === 0) {
    notificationSubscribersByUserId.delete(userId);
  }
}

function encodeSseEvent(eventName: string, payload: Record<string, unknown>): Uint8Array {
  return textEncoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}
