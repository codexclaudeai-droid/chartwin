export const AUTH_SESSION_CHANGED_EVENT = 'chart-service-auth-session-changed';

type AuthEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

export function subscribeAuthSessionChangedEvent(
  callback: () => void,
  target: AuthEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!target) {
    return () => {};
  }

  target.addEventListener(AUTH_SESSION_CHANGED_EVENT, callback);
  return () => target.removeEventListener(AUTH_SESSION_CHANGED_EVENT, callback);
}

export function dispatchAuthSessionChangedEvent(target: AuthEventTarget | null = getBrowserEventTarget()): void {
  if (!target) return;
  target.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

function getBrowserEventTarget(): AuthEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}
