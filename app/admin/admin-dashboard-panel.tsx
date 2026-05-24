'use client';

import { useEffect, useState } from 'react';
import {
  getAdminDashboardPriority,
  getAdminDashboardQueueItems,
} from './admin-dashboard-priority';
import { dispatchAdminAuditLogPresetEvent } from './admin-audit-log-preset-events';
import { dispatchAdminQueuePresetEvent } from './admin-queue-preset-events';
import { subscribeAdminRefreshEvent } from './admin-refresh-events';

type AdminDashboardSummary = {
  payments: {
    totalCount: number;
    queueCount: number;
    pendingCount: number;
    confirmedCount: number;
    refundedCount: number;
    rejectedCount: number;
  };
  subscriptions: {
    totalCount: number;
    queueCount: number;
    activeCount: number;
    trialActiveCount: number;
    paymentPendingCount: number;
    cancelRequestedCount: number;
    refundRequestedCount: number;
  };
  support: {
    totalCount: number;
    waitingCount: number;
    answeredCount: number;
    privateCount: number;
  };
  users: {
    totalCount: number;
    activeCount: number;
    suspendedCount: number;
    adminCount: number;
  };
  audit: {
    totalCount: number;
  };
};

type AdminDashboardResponse = {
  ok: boolean;
  message?: string;
  summary?: AdminDashboardSummary;
};

export function AdminDashboardPanel() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [message, setMessage] = useState('관리자 운영 요약을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
    return subscribeAdminRefreshEvent(() => {
      void refresh();
    });
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/dashboard', { cache: 'no-store' });
    const payload = await response.json() as AdminDashboardResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setSummary(null);
      setMessage(payload.message || '관리자 로그인 후 운영 요약을 확인할 수 있습니다.');
      return;
    }

    setSummary(payload.summary);
    setMessage('관리자 운영 요약이 최신 상태로 갱신되었습니다.');
  }

  function dispatchPriorityQueuePreset(priority: ReturnType<typeof getAdminDashboardPriority>) {
    if (!priority.panel || !priority.presetKey) return;

    dispatchAdminQueuePresetEvent({
      panel: priority.panel,
      presetKey: priority.presetKey,
    });
  }

  const priority = summary ? getAdminDashboardPriority(summary) : null;
  const queueItems = summary ? getAdminDashboardQueueItems(summary) : [];

  return (
    <section className="card wide">
      <div className="toolbar">
        <h2>운영 대시보드</h2>
        <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
      </div>
      <p className="notice">{message}</p>
      {summary && (
        <>
          {priority && (
            <a
              className={`dashboard-priority ${priority.tone}`}
              href={priority.href}
              onClick={() => dispatchPriorityQueuePreset(priority)}
            >
              <span>다음 작업</span>
              <strong>{priority.title}</strong>
              <p>{priority.description}</p>
            </a>
          )}
          <div className="dashboard-queue-panel">
            <div className="toolbar compact">
              <h3>처리 대기 큐</h3>
              <span>{queueItems.length > 0 ? `${queueItems.length}개 영역 대기` : '대기 없음'}</span>
            </div>
            {queueItems.length > 0 ? (
              <div className="dashboard-queue-grid">
                {queueItems.map((item) => (
                  <a
                    className={`dashboard-queue-card ${item.tone}`}
                    href={item.href}
                    key={item.key}
                    onClick={() => dispatchAdminQueuePresetEvent({
                      panel: item.panel,
                      presetKey: item.presetKey,
                    })}
                  >
                    <span>{item.title}</span>
                    <strong>{item.countLabel}</strong>
                    <div className="dashboard-queue-meta">
                      <small>처리: {item.actionLabel}</small>
                      <small>필터: {item.filterLabel}</small>
                    </div>
                    <p>{item.description}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="notice">지금은 수동으로 처리할 운영 대기 건이 없습니다.</p>
            )}
          </div>
          <div className="summary-grid">
            <a
              className="mini-card dashboard-summary-card dashboard-payment-card"
              href="#admin-payments"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'payments',
                presetKey: 'pending',
              })}
            >
              <span>입금 확인</span>
              <strong>대기 {summary.payments.pendingCount}건</strong>
              <p>전체 결제 {summary.payments.totalCount}건, 확인 완료 {summary.payments.confirmedCount}건</p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-subscription-card"
              href="#admin-subscriptions"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'subscriptions',
                presetKey: 'all',
              })}
            >
              <span>구독 승인/변경</span>
              <strong>처리 대기 {summary.subscriptions.queueCount}건</strong>
              <p>입금 대기 {summary.subscriptions.paymentPendingCount}건, 환불 대기 {summary.subscriptions.refundRequestedCount}건</p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-support-card"
              href="#admin-support"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'support',
                presetKey: 'waiting',
              })}
            >
              <span>고객센터</span>
              <strong>답변 대기 {summary.support.waitingCount}건</strong>
              <p>전체 문의 {summary.support.totalCount}건, 비공개 {summary.support.privateCount}건</p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-user-card"
              href="#admin-users"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'users',
                presetKey: 'suspended',
              })}
            >
              <span>회원 상태</span>
              <strong>정지 {summary.users.suspendedCount}건</strong>
              <p>전체 회원 {summary.users.totalCount}명, 정상 {summary.users.activeCount}명, 관리자 {summary.users.adminCount}명</p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-audit-card"
              href="#admin-audit-logs"
              onClick={() => dispatchAdminAuditLogPresetEvent({ presetKey: 'all' })}
            >
              <span>감사 로그</span>
              <strong>{summary.audit.totalCount}건</strong>
              <p>관리자 승인, 반려, 환불, 답변 처리 기록입니다.</p>
            </a>
          </div>
        </>
      )}
    </section>
  );
}
