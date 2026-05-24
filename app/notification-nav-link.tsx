'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatNotificationBadgeCount } from '../src/domain/chart-service/index.ts';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { subscribeNotificationsRefreshEvent } from './notification-events';

export function NotificationNavLink() {
  const [badge, setBadge] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function refreshBadge() {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) {
        if (isMounted) setBadge(null);
        return;
      }
      const payload = await response.json();
      if (isMounted) {
        setBadge(formatNotificationBadgeCount(payload.summary?.unreadCount ?? 0));
      }
    }

    void refreshBadge();
    const unsubscribe = subscribeNotificationsRefreshEvent(() => {
      void refreshBadge();
    });
    const unsubscribeAuth = subscribeAuthSessionChangedEvent(() => {
      void refreshBadge();
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  return (
    <Link className="nav-alert-link" href="/notifications">
      알림
      {badge && <span className="nav-badge" aria-label={`안 읽은 알림 ${badge}개`}>{badge}</span>}
    </Link>
  );
}
