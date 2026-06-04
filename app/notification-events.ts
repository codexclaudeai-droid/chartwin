export const NOTIFICATIONS_REFRESH_EVENT = 'chart-service-notifications-refresh';

type RefreshEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

type ServiceWorkerMessageTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

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

function getBrowserEventTarget(): RefreshEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function getBrowserServiceWorker(): ServiceWorkerMessageTarget | null {
  return typeof navigator === 'undefined' ? null : navigator.serviceWorker ?? null;
}
