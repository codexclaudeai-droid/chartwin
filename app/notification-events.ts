export const NOTIFICATIONS_REFRESH_EVENT = 'chart-service-notifications-refresh';

type RefreshEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

type ServiceWorkerMessageTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type NotificationRealtimeEventSource = Pick<EventSource, 'addEventListener' | 'removeEventListener' | 'close'>;

type NotificationRealtimeEventSourceFactory = (url: string) => NotificationRealtimeEventSource;

export function subscribeNotificationsRefreshEvent(
  callback: () => void,
  target: RefreshEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!target) {
    return () => {};
  }

  target.addEventListener(NOTIFICATIONS_REFRESH_EVENT, callback);
  return () => target.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, callback);
}

export function dispatchNotificationsRefreshEvent(target: RefreshEventTarget | null = getBrowserEventTarget()): void {
  if (!target) return;
  target.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

export function subscribeServiceWorkerNotificationsRefreshMessages(
  serviceWorker: ServiceWorkerMessageTarget | null = getBrowserServiceWorker(),
  target: RefreshEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!serviceWorker || !target) {
    return () => {};
  }

  const handleMessage = (event: Event) => {
    const data = (event as MessageEvent).data;
    if (data?.type !== NOTIFICATIONS_REFRESH_EVENT) return;

    dispatchNotificationsRefreshEvent(target);
  };

  serviceWorker.addEventListener('message', handleMessage);
  return () => serviceWorker.removeEventListener('message', handleMessage);
}

export function subscribeNotificationRealtimeStream(
  callback: () => void,
  eventSourceFactory: NotificationRealtimeEventSourceFactory | null = getBrowserEventSourceFactory(),
): () => void {
  if (!eventSourceFactory) {
    return () => {};
  }

  const eventSource = eventSourceFactory('/api/notifications/stream');
  eventSource.addEventListener('notifications.changed', callback);

  return () => {
    eventSource.removeEventListener('notifications.changed', callback);
    eventSource.close();
  };
}

function getBrowserEventTarget(): RefreshEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function getBrowserServiceWorker(): ServiceWorkerMessageTarget | null {
  return typeof navigator === 'undefined' ? null : navigator.serviceWorker ?? null;
}

function getBrowserEventSourceFactory(): NotificationRealtimeEventSourceFactory | null {
  if (typeof EventSource === 'undefined') return null;
  return (url: string) => new EventSource(url);
}
