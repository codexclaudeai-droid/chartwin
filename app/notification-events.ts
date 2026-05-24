export const NOTIFICATIONS_REFRESH_EVENT = 'chart-service-notifications-refresh';

type RefreshEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

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

function getBrowserEventTarget(): RefreshEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}
