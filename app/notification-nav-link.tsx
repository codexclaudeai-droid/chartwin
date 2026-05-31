'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatNotificationBadgeCount } from '../src/domain/chart-service/index.ts';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { subscribeNotificationsRefreshEvent } from './notification-events';
import { getNotificationCenterHref } from './notifications/notification-display';

const NOTIFICATION_BADGE_POLL_INTERVAL_MS = 60 * 1000;

export function NotificationNavLink() {
  const [badge, setBadge] = useState<string | null>(null);
  const [notificationHref, setNotificationHref] = useState('/notifications');

  useEffect(() => {
    let isMounted = true;

    async function refreshBadge() {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) {
        if (isMounted) {
          setBadge(null);
          setNotificationHref('/notifications');
        }
        return;
      }
      const payload = await response.json();
      if (isMounted) {
        const unreadCount = payload.summary?.unreadCount ?? 0;
        setBadge(formatNotificationBadgeCount(unreadCount));
        setNotificationHref(getNotificationCenterHref(unreadCount));
      }
    }

    void refreshBadge();
    const unsubscribe = subscribeNotificationsRefreshEvent(() => {
      void refreshBadge();
    });
    const unsubscribeAuth = subscribeAuthSessionChangedEvent(() => {
      void refreshBadge();
    });
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshBadge();
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshBadge();
    }, NOTIFICATION_BADGE_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  return (
    <Link className="nav-alert-link" href={notificationHref}>
      알림
      {badge && <span className="nav-badge" aria-label={`안 읽은 알림 ${badge}개`}>{badge}</span>}
    </Link>
  );
}
