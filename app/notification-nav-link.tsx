'use client';

import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatNotificationBadgeCount } from '../src/domain/chart-service/index.ts';
import { playNotificationVoice } from '../src/domain/chart-service/notification-voice.ts';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import {
  subscribeNotificationsRefreshEvent,
  subscribeServiceWorkerNotificationsRefreshMessages,
} from './notification-events';
import { getAuthSession } from './auth-session-client';
import {
  getNotificationList,
  getNotificationSummary,
  type NotificationListItem,
} from './notification-summary-client';
import {
  getNotificationCenterHref,
  normalizeNotificationTitle,
} from './notifications/notification-display';

const NOTIFICATION_BADGE_POLL_INTERVAL_MS = 60 * 1000;

export function NotificationNavLink() {
  const [badge, setBadge] = useState<string | null>(null);
  const [notificationHref, setNotificationHref] = useState('/notifications');
  const previousUnreadCountRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function refreshBadge(options: { force?: boolean } = {}) {
      const session = await getAuthSession(options);
      if (!session.authenticated) {
        previousUnreadCountRef.current = null;
        if (isMounted) {
          setBadge(null);
          setNotificationHref('/notifications');
        }
        return;
      }

      const payload = await getNotificationSummary(options);
      if (!payload.ok || !payload.summary) {
        previousUnreadCountRef.current = null;
        if (isMounted) {
          setBadge(null);
          setNotificationHref('/notifications');
        }
        return;
      }
      const unreadCount = payload.summary?.unreadCount ?? 0;
      void playLatestNotificationVoiceIfNeeded(unreadCount);
      if (isMounted) {
        setBadge(formatNotificationBadgeCount(unreadCount));
        setNotificationHref(getNotificationCenterHref(unreadCount));
      }
    }

    async function playLatestNotificationVoiceIfNeeded(unreadCount: number) {
      const previousUnreadCount = previousUnreadCountRef.current;
      previousUnreadCountRef.current = unreadCount;
      if (previousUnreadCount === null || unreadCount <= previousUnreadCount) return;
      if (window.location.pathname.startsWith('/notifications')) return;

      const payload = await getNotificationList({ force: true });
      if (!payload.ok) return;
      const latestNotification = getLatestUnreadNotification(payload.notifications);
      if (!latestNotification) return;

      void playNotificationVoice({
        category: latestNotification.category,
        title: normalizeNotificationTitle(latestNotification.title),
        body: latestNotification.body,
      });
    }

    void refreshBadge();
    const unsubscribe = subscribeNotificationsRefreshEvent(() => {
      void refreshBadge({ force: true });
    });
    const unsubscribeAuth = subscribeAuthSessionChangedEvent(() => {
      void refreshBadge({ force: true });
    });
    const unsubscribeServiceWorker = subscribeServiceWorkerNotificationsRefreshMessages();
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshBadge({ force: true });
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
      unsubscribeServiceWorker();
    };
  }, []);

  return (
    <Link className="nav-alert-link" href={notificationHref}>
      <span className="mobile-nav-link-icon" aria-hidden="true"><BellRing /></span>
      <span className="mobile-nav-link-label">알림</span>
      {badge && <span className="nav-badge" aria-label={`안 읽은 알림 ${badge}개`}>{badge}</span>}
    </Link>
  );
}

function getLatestUnreadNotification(notifications: NotificationListItem[]): NotificationListItem | null {
  return notifications
    .filter((notification) => !notification.readAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1) ?? null;
}
