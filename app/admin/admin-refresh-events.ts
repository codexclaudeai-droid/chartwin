export const ADMIN_REFRESH_EVENT = 'chart-service-admin-refresh';

type RefreshEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;
export type AdminRefreshSource = 'payments' | 'subscriptions' | 'support' | 'users' | 'webInfo';
export type AdminRefreshEventDetail = {
  source?: AdminRefreshSource;
};

export function subscribeAdminRefreshEvent(
  callback: (detail: AdminRefreshEventDetail) => void,
  target: RefreshEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!target) {
    return () => {};
  }

  const listener = (event: Event) => {
    callback(getAdminRefreshEventDetail(event));
  };

  target.addEventListener(ADMIN_REFRESH_EVENT, listener);
  return () => target.removeEventListener(ADMIN_REFRESH_EVENT, listener);
}

export function dispatchAdminRefreshEvent(): void;
export function dispatchAdminRefreshEvent(target: RefreshEventTarget | null): void;
export function dispatchAdminRefreshEvent(
  detail: AdminRefreshEventDetail,
  target?: RefreshEventTarget | null,
): void;
export function dispatchAdminRefreshEvent(
  detailOrTarget: AdminRefreshEventDetail | RefreshEventTarget | null = {},
  target: RefreshEventTarget | null = getBrowserEventTarget(),
): void {
  if (detailOrTarget === null) {
    return;
  }

  if (isRefreshEventTarget(detailOrTarget)) {
    detailOrTarget.dispatchEvent(createAdminRefreshEvent({}));
    return;
  }

  if (!target) return;
  target.dispatchEvent(createAdminRefreshEvent(detailOrTarget));
}

function getBrowserEventTarget(): RefreshEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function isRefreshEventTarget(value: unknown): value is RefreshEventTarget {
  return Boolean(value && typeof (value as RefreshEventTarget).dispatchEvent === 'function');
}

function createAdminRefreshEvent(detail: AdminRefreshEventDetail): Event {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(ADMIN_REFRESH_EVENT, { detail });
  }

  const event = new Event(ADMIN_REFRESH_EVENT) as Event & { detail?: AdminRefreshEventDetail };
  event.detail = detail;
  return event;
}

function getAdminRefreshEventDetail(event: Event): AdminRefreshEventDetail {
  const detail = (event as Event & { detail?: AdminRefreshEventDetail | null }).detail;
  return detail && typeof detail === 'object' ? detail : {};
}
