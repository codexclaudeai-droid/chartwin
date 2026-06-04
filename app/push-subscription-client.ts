'use client';

type PushServerResponse = {
  message?: string;
};

export function isBrowserPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function createBrowserPushSubscription(publicKey: string): Promise<PushSubscription> {
  const registration = await getOrRegisterBrowserPushRegistration();
  if (!registration) throw new Error('이 브라우저에서는 푸시 알림을 지원하지 않습니다.');

  const existingSubscription = await registration.pushManager.getSubscription();
  return existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  });
}

export async function getCurrentBrowserPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getOrRegisterBrowserPushRegistration();
  return registration ? await registration.pushManager.getSubscription() : null;
}

export async function syncExistingBrowserPushSubscriptionForCurrentUser(
  userId?: string | null,
): Promise<boolean> {
  if (!isBrowserPushSupported() || Notification.permission !== 'granted') return false;

  const registration = await getExistingBrowserPushRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return false;
  if (isPushSyncRemembered(userId, subscription.endpoint)) return true;

  await syncCurrentBrowserPushSubscription(subscription);
  rememberPushSync(userId, subscription.endpoint);
  return true;
}

export async function syncCurrentBrowserPushSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    throw new Error(await readPushServerMessage(response, '푸시 알림 구독에 실패했습니다.'));
  }
}

export async function detachBrowserPushSubscriptionForCurrentUser(): Promise<boolean> {
  return releaseBrowserPushSubscription({ unsubscribeBrowser: false });
}

export async function disableBrowserPushSubscription(): Promise<boolean> {
  return releaseBrowserPushSubscription({ unsubscribeBrowser: true });
}

async function releaseBrowserPushSubscription(input: { unsubscribeBrowser: boolean }): Promise<boolean> {
  if (!isBrowserPushSupported()) return false;

  const registration = await getExistingBrowserPushRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return false;

  const response = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) {
    if (input.unsubscribeBrowser) await subscription.unsubscribe();
    throw new Error(await readPushServerMessage(response, '푸시 알림 해제에 실패했습니다.'));
  }

  forgetPushSync(subscription.endpoint);
  if (input.unsubscribeBrowser) await subscription.unsubscribe();
  return true;
}

async function getOrRegisterBrowserPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isBrowserPushSupported()) return null;
  return navigator.serviceWorker.register('/sw.js');
}

async function getExistingBrowserPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isBrowserPushSupported()) return null;
  return await navigator.serviceWorker.getRegistration() ?? null;
}

async function readPushServerMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null) as PushServerResponse | null;
  return typeof payload?.message === 'string' && payload.message.trim() ? payload.message : fallback;
}

function rememberPushSync(userId: string | null | undefined, endpoint: string): void {
  if (!userId || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(`chart-service-push-sync:${userId}`, endpoint);
}

function isPushSyncRemembered(userId: string | null | undefined, endpoint: string): boolean {
  if (!userId || typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(`chart-service-push-sync:${userId}`) === endpoint;
}

function forgetPushSync(endpoint: string): void {
  if (typeof sessionStorage === 'undefined') return;
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith('chart-service-push-sync:') && sessionStorage.getItem(key) === endpoint) {
      sessionStorage.removeItem(key);
    }
  }
}

function base64UrlToUint8Array(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
