'use client';

import { useEffect, useState } from 'react';
import { dispatchNotificationsRefreshEvent } from '../notification-events';

type NotificationRecord = {
  id: string;
  category: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({ totalCount: 0, unreadCount: 0 });
  const [message, setMessage] = useState('로그인하면 관리자 처리 결과와 고객센터 답변 알림을 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);

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
    setMessage(`알림 ${payload.summary?.totalCount ?? 0}건 중 안 읽은 알림 ${payload.summary?.unreadCount ?? 0}건이 있습니다.`);
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

  async function markAllRead() {
    setIsBusy(true);
    const response = await fetch('/api/notifications/read-all', { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '전체 읽음 처리에 실패했습니다.');
      return;
    }
    setMessage(`${payload.updatedCount}건을 읽음 처리했습니다.`);
    dispatchNotificationsRefreshEvent();
    await refresh();
  }

  return (
    <section className="card wide">
      <div className="toolbar">
        <h2>내 알림</h2>
        <div className="actions compact">
          <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
          <button className="button" type="button" onClick={markAllRead} disabled={isBusy || summary.unreadCount === 0}>
            모두 읽음
          </button>
        </div>
      </div>
      <p className="notice">{message}</p>
      <div className="thread-list">
        {notifications.map((notification) => (
          <article className="thread-card" key={notification.id}>
            <div className="thread-meta">
              <span className="badge">{notification.category}</span>
              <span>{notification.readAt ? '읽음' : '안 읽음'}</span>
              <span>{new Date(notification.createdAt).toLocaleString()}</span>
            </div>
            <h3>{notification.title}</h3>
            <p>{notification.body}</p>
            <div className="actions compact">
              {notification.linkUrl && <a className="text-link" href={notification.linkUrl}>관련 화면으로 이동</a>}
              {!notification.readAt && (
                <button className="button secondary" type="button" onClick={() => markOneRead(notification.id)} disabled={isBusy}>
                  읽음 처리
                </button>
              )}
            </div>
          </article>
        ))}
        {notifications.length === 0 && <p className="notice">표시할 알림이 없습니다.</p>}
      </div>
    </section>
  );
}
