export const ADMIN_AUDIT_LOG_PRESET_EVENT = 'chart-service-admin-audit-log-preset';

export type AdminAuditLogPresetEventDetail = {
  presetKey: string;
};

type AuditLogPresetEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

type AuditLogPresetEvent = Event & {
  detail?: AdminAuditLogPresetEventDetail;
};

export function subscribeAdminAuditLogPresetEvent(
  callback: (detail: AdminAuditLogPresetEventDetail) => void,
  target: AuditLogPresetEventTarget | null = getBrowserEventTarget(),
): () => void {
  if (!target) {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as AuditLogPresetEvent).detail;
    if (!detail) return;
    callback(detail);
  };

  target.addEventListener(ADMIN_AUDIT_LOG_PRESET_EVENT, listener);
  return () => target.removeEventListener(ADMIN_AUDIT_LOG_PRESET_EVENT, listener);
}

export function dispatchAdminAuditLogPresetEvent(
  detail: AdminAuditLogPresetEventDetail,
  target: AuditLogPresetEventTarget | null = getBrowserEventTarget(),
): void {
  if (!target) return;
  target.dispatchEvent(createAuditLogPresetEvent(detail));
}

function createAuditLogPresetEvent(detail: AdminAuditLogPresetEventDetail): Event {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(ADMIN_AUDIT_LOG_PRESET_EVENT, { detail });
  }

  const event = new Event(ADMIN_AUDIT_LOG_PRESET_EVENT) as AuditLogPresetEvent;
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function getBrowserEventTarget(): AuditLogPresetEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}
