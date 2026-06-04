'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  dispatchNotificationsRefreshEvent,
  subscribeNotificationsRefreshEvent,
} from '../notification-events';
import { RefreshIconButton } from '../shared/refresh-icon-button';
import { PushNotificationControl } from './push-notification-control';
import {
  playNotificationVoice,
} from '../../src/domain/chart-service/notification-voice.ts';
import {
  NOTIFICATION_FILTER_TABS,
  type NotificationFilterKey,
  filterNotificationsByTab,
  formatNotificationReadState,
  formatNotificationSummaryMessage,
  getNotificationBulkActionHint,
  getNotificationCategoryLabel,
  getNotificationEmptyStateMessage,
  getNotificationFilterHelpMessage,
  getNotificationFilterKeyFromSearch,
  getNotificationLinkLabel,
  getNotificationNavigationMessage,
  getNewUnreadNotifications,
  getNotificationSummaryFromList,
  getNotificationsWithoutIds,
  getNotificationsWithReadState,
  getUnreadNotificationsByTab,
  normalizeNotificationTitle,
} from './notification-display';

type NotificationRecord = {
  id: string;
  category: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

type MarkNotificationReadOptions = {
  refreshAfter?: boolean;
};

const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000;

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const notificationsRef = useRef<NotificationRecord[]>([]);
  const hasLoadedNotificationsRef = useRef(false);
  const [summary, setSummary] = useState<NotificationSummary>({ totalCount: 0, unreadCount: 0 });
  const [activeFilterKey, setActiveFilterKey] = useState<NotificationFilterKey>(() => getCurrentNotificationFilterKey());
  const [message, setMessage] = useState('로그인하면 결제 승인, 구독 상태, 고객센터 답변 알림을 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const filteredNotifications = filterNotificationsByTab(notifications, activeFilterKey);
  const filteredUnreadNotifications = getUnreadNotificationsByTab(notifications, activeFilterKey);
  const emptyStateMessage = getNotificationEmptyStateMessage(activeFilterKey, notifications.length > 0);
  const filterHelpMessage = getNotificationFilterHelpMessage(activeFilterKey);
  const bulkActionHint = getNotificationBulkActionHint(summary, activeFilterKey, filteredUnreadNotifications.length);
  const bulkActionHintId = bulkActionHint ? 'notification-bulk-action-hint' : undefined;

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    return subscribeNotificationsRefreshEvent(() => {
      void refresh();
    });
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, NOTIFICATION_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const syncFilterFromUrl = () => setActiveFilterKey(getCurrentNotificationFilterKey());

    syncFilterFromUrl();
    window.addEventListener('popstate', syncFilterFromUrl);

    return () => window.removeEventListener('popstate', syncFilterFromUrl);
  }, []);

  function applyFilter(filterKey: NotificationFilterKey) {
    setActiveFilterKey(filterKey);
    if (typeof window === 'undefined') return;

    const nextUrl = new URL(window.location.href);
    if (filterKey === 'all') {
      nextUrl.searchParams.delete('tab');
    } else {
      nextUrl.searchParams.set('tab', filterKey);
    }
    window.history.pushState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  function applyLocalReadState(notificationIds: string[]) {
    const readAt = new Date().toISOString();
    const nextNotifications = getNotificationsWithReadState(notificationsRef.current, notificationIds, readAt);

    setNotificationRecords(nextNotifications);
    setSummary(getNotificationSummaryFromList(nextNotifications));
  }

  function applyLocalArchiveState(notificationId: string) {
    const nextNotifications = getNotificationsWithoutIds(notificationsRef.current, [notificationId]);

    setNotificationRecords(nextNotifications);
    setSummary(getNotificationSummaryFromList(nextNotifications));
  }

  function setNotificationRecords(nextNotifications: NotificationRecord[]) {
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
  }

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/notifications');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setNotificationRecords([]);
      setSummary({ totalCount: 0, unreadCount: 0 });
      setMessage(payload.message || '알림을 보려면 로그인이 필요합니다.');
      return;
    }
    const nextNotifications = payload.notifications || [];
    const newUnreadNotifications = getNewUnreadNotifications(notificationsRef.current, nextNotifications);
    speakNewUnreadNotifications(newUnreadNotifications);
    setNotificationRecords(nextNotifications);
    setSummary(payload.summary || { totalCount: 0, unreadCount: 0 });
    setMessage(formatNotificationSummaryMessage(payload.summary || { totalCount: 0, unreadCount: 0 }));
    if (newUnreadNotifications.length > 0) {
      dispatchNotificationsRefreshEvent();
    }
  }

  function speakNewUnreadNotifications(newUnreadNotifications: NotificationRecord[]) {
    if (!hasLoadedNotificationsRef.current) {
      hasLoadedNotificationsRef.current = true;
      return;
    }

    const latestNotification = newUnreadNotifications.at(-1);
    if (!latestNotification) return;

    void playNotificationVoice({
      category: latestNotification.category,
      title: normalizeNotificationTitle(latestNotification.title),
      body: latestNotification.body,
    });
  }

  async function markNotificationRead(
    notificationId: string,
    options: MarkNotificationReadOptions = {},
  ): Promise<boolean> {
    setIsBusy(true);
    const response = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '알림 읽음 처리에 실패했습니다.');
      return false;
    }
    applyLocalReadState([notificationId]);
    dispatchNotificationsRefreshEvent();
    if (options.refreshAfter !== false) {
      await refresh();
    }
    return true;
  }

  async function markOneRead(notificationId: string) {
    await markNotificationRead(notificationId);
  }

  async function handleNotificationAction(
    event: React.MouseEvent<HTMLAnchorElement>,
    notification: NotificationRecord,
  ) {
    if (!notification.linkUrl || notification.readAt) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    setMessage(getNotificationNavigationMessage(notification));
    const wasMarkedRead = await markNotificationRead(notification.id, { refreshAfter: false });
    if (wasMarkedRead) {
      window.location.assign(notification.linkUrl);
    }
  }

  async function archiveNotification(notificationId: string) {
    setIsBusy(true);
    const response = await fetch(`/api/notifications/${notificationId}/archive`, { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '알림 숨김 처리에 실패했습니다.');
      return;
    }
    applyLocalArchiveState(notificationId);
    dispatchNotificationsRefreshEvent();
    await refresh();
    setMessage('알림을 목록에서 숨겼습니다.');
  }

  async function markAllRead() {
    setIsBusy(true);
    const response = await fetch('/api/notifications/read-all', { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '전체 알림 읽음 처리에 실패했습니다.');
      return;
    }
    applyLocalReadState(notifications.filter((notification) => !notification.readAt).map((notification) => notification.id));
    dispatchNotificationsRefreshEvent();
    await refresh();
    setMessage(`${payload.updatedCount}건을 읽음 처리했습니다.`);
  }

  async function markFilteredRead() {
    if (filteredUnreadNotifications.length === 0) return;

    const notificationIds = filteredUnreadNotifications.map((notification) => notification.id);
    const updatedCount = notificationIds.length;
    setIsBusy(true);
    try {
      await Promise.all(filteredUnreadNotifications.map(async (notification) => {
        const response = await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || '현재 필터 알림 읽음 처리에 실패했습니다.');
        }
      }));
      applyLocalReadState(notificationIds);
      dispatchNotificationsRefreshEvent();
      await refresh();
      setMessage(`${updatedCount}건을 현재 필터에서 읽음 처리했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현재 필터 알림 읽음 처리에 실패했습니다.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="card wide">
      <div className="toolbar">
        <h2>알림센터</h2>
        <div className="actions compact">
          <PushNotificationControl />
          <RefreshIconButton onClick={refresh} disabled={isBusy} />
          <button
            aria-describedby={summary.unreadCount === 0 ? bulkActionHintId : undefined}
            className="button"
            disabled={isBusy || summary.unreadCount === 0}
            onClick={markAllRead}
            title={summary.unreadCount === 0 ? bulkActionHint ?? undefined : undefined}
            type="button"
          >
            모두 읽음
          </button>
          <button
            aria-describedby={filteredUnreadNotifications.length === 0 ? bulkActionHintId : undefined}
            className="button secondary"
            disabled={isBusy || filteredUnreadNotifications.length === 0}
            onClick={markFilteredRead}
            title={filteredUnreadNotifications.length === 0 ? bulkActionHint ?? undefined : undefined}
            type="button"
          >
            현재 필터 읽음
          </button>
        </div>
      </div>
      <p className="notice">{message}</p>
      {bulkActionHint && <p className="notice compact" id={bulkActionHintId}>{bulkActionHint}</p>}
      <div className="quick-filter-row" aria-label="알림 필터">
        {NOTIFICATION_FILTER_TABS.map((tab) => {
          const isActive = activeFilterKey === tab.key;
          return (
            <button
              aria-pressed={isActive}
              className={`button secondary${isActive ? ' active' : ''}`}
              key={tab.key}
              onClick={() => applyFilter(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="notice compact">현재 필터: {NOTIFICATION_FILTER_TABS.find((tab) => tab.key === activeFilterKey)?.label ?? '전체'} / 표시 {filteredNotifications.length}건 / 미확인 {filteredUnreadNotifications.length}건</p>
      {filterHelpMessage && <p className="notice compact">{filterHelpMessage}</p>}
      <div className="thread-list">
        {filteredNotifications.map((notification) => (
          <article className="thread-card" key={notification.id}>
            <div className="thread-meta">
              <span className="badge">{getNotificationCategoryLabel(notification.category)}</span>
              <span>{formatNotificationReadState(notification.readAt)}</span>
              <span>{new Date(notification.createdAt).toLocaleString()}</span>
            </div>
            <h3>{normalizeNotificationTitle(notification.title)}</h3>
            <p>{notification.body}</p>
            <div className="actions compact">
              {notification.linkUrl && (
                <a
                  className="text-link notification-action-link"
                  href={notification.linkUrl}
                  onClick={(event) => handleNotificationAction(event, notification)}
                >
                  {getNotificationLinkLabel(notification)}
                </a>
              )}
              {!notification.readAt && (
                <button className="button secondary" type="button" onClick={() => markOneRead(notification.id)} disabled={isBusy}>
                  읽음 처리
                </button>
              )}
              <button className="button secondary" type="button" onClick={() => archiveNotification(notification.id)} disabled={isBusy}>
                숨기기
              </button>
            </div>
          </article>
        ))}
        {filteredNotifications.length === 0 && <p className="notice">{emptyStateMessage}</p>}
      </div>
    </section>
  );
}

function getCurrentNotificationFilterKey(): NotificationFilterKey {
  if (typeof window === 'undefined') return 'all';

  return getNotificationFilterKeyFromSearch(window.location.search);
}
