'use client';

import { useEffect, useState } from 'react';
import { dispatchNotificationsRefreshEvent } from '../notification-events';
import {
  NOTIFICATION_FILTER_TABS,
  type NotificationFilterKey,
  filterNotificationsByTab,
  formatNotificationReadState,
  formatNotificationSummaryMessage,
  getNotificationCategoryLabel,
  getNotificationLinkLabel,
  getUnreadNotificationsByTab,
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

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({ totalCount: 0, unreadCount: 0 });
  const [activeFilterKey, setActiveFilterKey] = useState<NotificationFilterKey>('all');
  const [message, setMessage] = useState('로그인하면 결제 승인, 구독 상태, 고객센터 답변 알림을 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const filteredNotifications = filterNotificationsByTab(notifications, activeFilterKey);
  const filteredUnreadNotifications = getUnreadNotificationsByTab(notifications, activeFilterKey);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/notifications');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setNotifications([]);
      setSummary({ totalCount: 0, unreadCount: 0 });
      setMessage(payload.message || '알림을 보려면 로그인이 필요합니다.');
      return;
    }
    setNotifications(payload.notifications || []);
    setSummary(payload.summary || { totalCount: 0, unreadCount: 0 });
    setMessage(formatNotificationSummaryMessage(payload.summary || { totalCount: 0, unreadCount: 0 }));
  }

  async function markOneRead(notificationId: string) {
    setIsBusy(true);
    const response = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '알림 읽음 처리에 실패했습니다.');
      return;
    }
    dispatchNotificationsRefreshEvent();
    await refresh();
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
    setMessage(`${payload.updatedCount}건을 읽음 처리했습니다.`);
    dispatchNotificationsRefreshEvent();
    await refresh();
  }

  async function markFilteredRead() {
    if (filteredUnreadNotifications.length === 0) return;

    const updatedCount = filteredUnreadNotifications.length;
    setIsBusy(true);
    try {
      await Promise.all(filteredUnreadNotifications.map(async (notification) => {
        const response = await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || '현재 필터 알림 읽음 처리에 실패했습니다.');
        }
      }));
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
          <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
          <button className="button" type="button" onClick={markAllRead} disabled={isBusy || summary.unreadCount === 0}>
            모두 읽음
          </button>
          <button className="button secondary" type="button" onClick={markFilteredRead} disabled={isBusy || filteredUnreadNotifications.length === 0}>
            현재 필터 읽음
          </button>
        </div>
      </div>
      <p className="notice">{message}</p>
      <div className="quick-filter-row" aria-label="알림 필터">
        {NOTIFICATION_FILTER_TABS.map((tab) => {
          const isActive = activeFilterKey === tab.key;
          return (
            <button
              aria-pressed={isActive}
              className={`button secondary${isActive ? ' active' : ''}`}
              key={tab.key}
              onClick={() => setActiveFilterKey(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="notice compact">현재 필터: {NOTIFICATION_FILTER_TABS.find((tab) => tab.key === activeFilterKey)?.label ?? '전체'} / 표시 {filteredNotifications.length}건 / 미확인 {filteredUnreadNotifications.length}건</p>
      <div className="thread-list">
        {filteredNotifications.map((notification) => (
          <article className="thread-card" key={notification.id}>
            <div className="thread-meta">
              <span className="badge">{getNotificationCategoryLabel(notification.category)}</span>
              <span>{formatNotificationReadState(notification.readAt)}</span>
              <span>{new Date(notification.createdAt).toLocaleString()}</span>
            </div>
            <h3>{notification.title}</h3>
            <p>{notification.body}</p>
            <div className="actions compact">
              {notification.linkUrl && (
                <a className="text-link notification-action-link" href={notification.linkUrl}>
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
        {notifications.length === 0 && <p className="notice">표시할 알림이 없습니다.</p>}
        {notifications.length > 0 && filteredNotifications.length === 0 && (
          <p className="notice">선택한 필터에 해당하는 알림이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
