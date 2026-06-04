'use client';

import { useEffect, useState } from 'react';
import { dispatchNotificationsRefreshEvent } from '../notification-events';
import {
  createBrowserPushSubscription,
  disableBrowserPushSubscription,
  getCurrentBrowserPushSubscription,
  isBrowserPushSupported,
  syncCurrentBrowserPushSubscription,
} from '../push-subscription-client';

type PushControlStatus = 'checking' | 'unsupported' | 'disabled' | 'available' | 'subscribed' | 'denied' | 'busy';

type PublicKeyResponse = {
  ok?: boolean;
  enabled?: boolean;
  publicKey?: string | null;
};

export function PushNotificationControl() {
  const [status, setStatus] = useState<PushControlStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState('앱 푸시 알림 상태를 확인하고 있습니다.');

  useEffect(() => {
    void refreshPushState();
  }, []);

  async function refreshPushState() {
    if (!isBrowserPushSupported()) {
      setStatus('unsupported');
      setMessage('이 브라우저에서는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' });
    const keyPayload = await keyResponse.json() as PublicKeyResponse;
    if (!keyPayload.enabled || !keyPayload.publicKey) {
      setStatus('disabled');
      setMessage('앱 푸시 알림 서버 키가 아직 설정되지 않았습니다.');
      return;
    }

    setPublicKey(keyPayload.publicKey);
    if (Notification.permission === 'denied') {
      setStatus('denied');
      setMessage('브라우저 알림 권한이 차단되어 있습니다.');
      return;
    }

    const subscription = await getCurrentBrowserPushSubscription();
    if (subscription) {
      try {
        await syncCurrentBrowserPushSubscription(subscription);
        setStatus('subscribed');
        setMessage('앱 푸시 알림이 현재 계정에 연결되어 있습니다.');
      } catch (error) {
        setStatus('available');
        setMessage(error instanceof Error ? error.message : '앱 푸시 알림 연결 확인에 실패했습니다.');
      }
      return;
    }

    setStatus('available');
    setMessage('앱 푸시 알림을 켤 수 있습니다.');
  }

  async function enablePush() {
    if (!publicKey) return;
    setStatus('busy');
    setMessage('앱 푸시 알림 권한과 구독 상태를 확인하고 있습니다.');

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'available');
        setMessage('알림 권한이 허용되지 않았습니다.');
        return;
      }

      const subscription = await createBrowserPushSubscription(publicKey);
      await syncCurrentBrowserPushSubscription(subscription);

      setStatus('subscribed');
      setMessage('앱 푸시 알림이 켜졌습니다.');
    } catch (error) {
      setStatus('available');
      setMessage(error instanceof Error ? error.message : '앱 푸시 알림 설정에 실패했습니다.');
    }
  }

  async function disablePush() {
    setStatus('busy');
    setMessage('앱 푸시 알림을 해제하고 있습니다.');

    try {
      await disableBrowserPushSubscription();

      setStatus('available');
      setMessage('앱 푸시 알림이 꺼졌습니다.');
    } catch (error) {
      setStatus('subscribed');
      setMessage(error instanceof Error ? error.message : '앱 푸시 알림 해제에 실패했습니다.');
    }
  }

  async function testPush() {
    setIsTesting(true);
    setMessage('테스트 푸시 알림을 보내고 있습니다.');

    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || '테스트 푸시 발송에 실패했습니다.');

      dispatchNotificationsRefreshEvent();
      const attempted = Number(payload.delivery?.attempted ?? 0);
      const delivered = Number(payload.delivery?.delivered ?? 0);
      if (attempted === 0) {
        setMessage('저장된 앱 푸시 알림 구독이 없습니다. 앱 푸시 알림을 다시 켜주세요.');
      } else if (delivered > 0) {
        setMessage('테스트 앱 푸시 알림을 보냈습니다. 기기 알림 영역을 확인해주세요.');
      } else {
        setMessage('테스트 알림은 생성됐지만 앱 푸시 발송은 확인되지 않았습니다.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '테스트 푸시 발송에 실패했습니다.');
    } finally {
      setIsTesting(false);
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
  const toggleLabel = isSubscribed ? '앱 푸시 알림 끄기' : '앱 푸시 알림 켜기';

  return (
    <div className="push-notification-control">
      <div className="push-notification-copy">
        <strong>앱 푸시 알림</strong>
        <span className="push-notification-status" role="status">{message}</span>
      </div>
      <div className="push-notification-actions">
        <button
          aria-checked={isSubscribed}
          aria-label={toggleLabel}
          className={`push-notification-toggle${isSubscribed ? ' active' : ''}`}
          disabled={isBusy || isTesting || status === 'denied'}
          onClick={isSubscribed ? disablePush : enablePush}
          role="switch"
          title={toggleLabel}
          type="button"
        >
          <span className="push-notification-toggle-track" aria-hidden="true">
            <span className="push-notification-toggle-thumb" />
          </span>
          <span className="push-notification-toggle-label">{toggleLabel}</span>
        </button>
        {isSubscribed && (
          <button
            className="button secondary compact push-notification-test-button"
            disabled={isBusy || isTesting}
            onClick={testPush}
            type="button"
          >
            테스트
          </button>
        )}
      </div>
    </div>
  );
}
