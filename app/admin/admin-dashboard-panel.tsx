'use client';

import {
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MessageCircle,
  Repeat,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  type AdminDashboardPriority,
  getAdminDashboardPriority,
  getAdminDashboardQueueItems,
} from './admin-dashboard-priority';
import { dispatchAdminAuditLogPresetEvent } from './admin-audit-log-preset-events';
import { dispatchAdminQueuePresetEvent } from './admin-queue-preset-events';
import { AdminRefreshButton } from './admin-refresh-button';
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

const ADMIN_OVERVIEW_CARD_ICONS: Record<AdminDashboardPriority['key'] | 'audit', LucideIcon> = {
  payments: CreditCard,
  subscriptions: Repeat,
  support: MessageCircle,
  users: Users,
  audit: ClipboardList,
  clear: CheckCircle2,
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
  const PriorityIcon = priority ? ADMIN_OVERVIEW_CARD_ICONS[priority.key] : CheckCircle2;

  return (
    <section className="card wide admin-overview-card">
      <div className="toolbar admin-overview-toolbar">
        <div>
          <span className="eyebrow">Operations</span>
          <h2>운영 대시보드</h2>
        </div>
        <AdminRefreshButton onClick={refresh} disabled={isBusy} />
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
              <span className="dashboard-card-label">
                <PriorityIcon aria-hidden="true" />
                <span>다음 작업</span>
              </span>
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
                  <DashboardQueueCard
                    item={item}
                    key={item.key}
                    onClick={() => dispatchAdminQueuePresetEvent({
                      panel: item.panel,
                      presetKey: item.presetKey,
                    })}
                  />
                ))}
              </div>
            ) : (
              <p className="notice">지금은 수동으로 처리할 운영 대기 건이 없습니다.</p>
            )}
          </div>
          <div className="summary-grid admin-overview-summary-grid">
            <a
              className="mini-card dashboard-summary-card dashboard-payment-card"
              href="#admin-payments"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'payments',
                presetKey: 'pending',
              })}
            >
              <DashboardCardLabel icon={CreditCard} label="입금 확인" />
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
              <DashboardCardLabel icon={Repeat} label="구독 승인/변경" />
              <strong>처리 대기 {summary.subscriptions.queueCount}건</strong>
              <p>
                입금 대기 {summary.subscriptions.paymentPendingCount}건, 환불 대기{' '}
                {summary.subscriptions.refundRequestedCount}건
              </p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-support-card"
              href="#admin-support"
              onClick={() => dispatchAdminQueuePresetEvent({
                panel: 'support',
                presetKey: 'waiting',
              })}
            >
              <DashboardCardLabel icon={MessageCircle} label="고객센터" />
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
              <DashboardCardLabel icon={Users} label="회원 상태" />
              <strong>정지 {summary.users.suspendedCount}건</strong>
              <p>
                전체 회원 {summary.users.totalCount}명, 정상 {summary.users.activeCount}명,
                관리자 {summary.users.adminCount}명
              </p>
            </a>
            <a
              className="mini-card dashboard-summary-card dashboard-audit-card"
              href="#admin-audit-logs"
              onClick={() => dispatchAdminAuditLogPresetEvent({ presetKey: 'all' })}
            >
              <DashboardCardLabel icon={ClipboardList} label="감사 로그" />
              <strong>{summary.audit.totalCount}건</strong>
              <p>관리자 승인, 반려, 환불, 답변 처리 기록입니다.</p>
            </a>
          </div>
        </>
      )}
    </section>
  );
}

function DashboardQueueCard({
  item,
  onClick,
}: Readonly<{
  item: ReturnType<typeof getAdminDashboardQueueItems>[number];
  onClick: () => void;
}>) {
  const QueueIcon = ADMIN_OVERVIEW_CARD_ICONS[item.key];

  return (
    <a
      className={`dashboard-queue-card ${item.tone}`}
      href={item.href}
      onClick={onClick}
    >
      <DashboardCardLabel icon={QueueIcon} label={item.title} />
      <strong>{item.countLabel}</strong>
      <div className="dashboard-queue-meta">
        <small>처리: {item.actionLabel}</small>
        <small>필터: {item.filterLabel}</small>
      </div>
      <p>{item.description}</p>
    </a>
  );
}

function DashboardCardLabel({
  icon: Icon,
  label,
}: Readonly<{
  icon: LucideIcon;
  label: string;
}>) {
  return (
    <span className="dashboard-card-label">
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
