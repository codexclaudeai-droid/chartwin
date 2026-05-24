export const ADMIN_QUEUE_PRESET_EVENT = 'chart-service-admin-queue-preset';

export type AdminQueuePresetPanel = 'payments' | 'subscriptions' | 'support' | 'users';

export type AdminQueuePresetEventDetail = {
  panel: AdminQueuePresetPanel;
  presetKey: string;
};

type QueuePresetEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

type QueuePresetEvent = Event & {
  detail?: AdminQueuePresetEventDetail;
};

export function subscribeAdminQueuePresetEvent(
  callback: (detail: AdminQueuePresetEventDetail) => void,
  target: QueuePresetEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!target) {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as QueuePresetEvent).detail;
    if (!detail) return;
    callback(detail);
  };

  target.addEventListener(ADMIN_QUEUE_PRESET_EVENT, listener);
  return () => target.removeEventListener(ADMIN_QUEUE_PRESET_EVENT, listener);
}

export function dispatchAdminQueuePresetEvent(
  detail: AdminQueuePresetEventDetail,
  target: QueuePresetEventTarget | null = getBrowserEventTarget(),
): void {
  if (!target) return;
  target.dispatchEvent(createQueuePresetEvent(detail));
}

function createQueuePresetEvent(detail: AdminQueuePresetEventDetail): Event {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(ADMIN_QUEUE_PRESET_EVENT, { detail });
  }

  const event = new Event(ADMIN_QUEUE_PRESET_EVENT) as QueuePresetEvent;
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function getBrowserEventTarget(): QueuePresetEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}
