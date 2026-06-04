'use client';

import { useEffect, useState } from 'react';

type PushControlStatus = 'checking' | 'unsupported' | 'disabled' | 'available' | 'subscribed' | 'denied' | 'busy';

type PublicKeyResponse = {
  ok?: boolean;
  enabled?: boolean;
  publicKey?: string | null;
};

export function PushNotificationControl() {
  const [status, setStatus] = useState<PushControlStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState('푸시 알림 상태를 확인하고 있습니다.');

  useEffect(() => {
    void refreshPushState();
  }, []);

  async function refreshPushState() {
    if (!isPushSupported()) {
      setStatus('unsupported');
      setMessage('이 브라우저에서는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' });
    const keyPayload = await keyResponse.json() as PublicKeyResponse;
    if (!keyPayload.enabled || !keyPayload.publicKey) {
      setStatus('disabled');
      setMessage('푸시 알림 서버 키가 아직 설정되지 않았습니다.');
      return;
    }

    setPublicKey(keyPayload.publicKey);
    if (Notification.permission === 'denied') {
      setStatus('denied');
      setMessage('브라우저 알림 권한이 차단되어 있습니다.');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.getSubscription();
    setStatus(subscription ? 'subscribed' : 'available');
    setMessage(subscription ? '브라우저 푸시 알림이 켜져 있습니다.' : '브라우저 푸시 알림을 켤 수 있습니다.');
  }

  async function enablePush() {
    if (!publicKey) return;
    setStatus('busy');
    setMessage('브라우저 권한과 구독 상태를 확인하고 있습니다.');

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'available');
        setMessage('알림 권한이 허용되지 않았습니다.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || '푸시 알림 구독에 실패했습니다.');

      setStatus('subscribed');
      setMessage('브라우저 푸시 알림이 켜졌습니다.');
    } catch (error) {
      setStatus('available');
      setMessage(error instanceof Error ? error.message : '푸시 알림 설정에 실패했습니다.');
    }
  }

  async function disablePush() {
    setStatus('busy');
    setMessage('브라우저 푸시 알림을 해제하고 있습니다.');

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setStatus('available');
      setMessage('브라우저 푸시 알림이 꺼졌습니다.');
    } catch (error) {
      setStatus('subscribed');
      setMessage(error instanceof Error ? error.message : '푸시 알림 해제에 실패했습니다.');
    }
  }

  if (status === 'unsupported') {
    return <span className="notice compact push-notification-status">{message}</span>;
  }

  if (status === 'disabled') {
    return <span className="notice compact push-notification-status">{message}</span>;
  }

  const isBusy = status === 'busy' || status === 'checking';
  const isSubscribed = status === 'subscribed';

  return (
    <div className="push-notification-control">
      <button
        className={`button secondary${isSubscribed ? ' active' : ''}`}
        disabled={isBusy || status === 'denied'}
        onClick={isSubscribed ? disablePush : enablePush}
        type="button"
      >
        {isSubscribed ? '푸시 알림 끄기' : '푸시 알림 켜기'}
      </button>
      <span className="notice compact push-notification-status">{message}</span>
    </div>
  );
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
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
