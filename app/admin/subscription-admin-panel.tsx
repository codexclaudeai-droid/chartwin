'use client';

import { useEffect, useState } from 'react';
import { formatPaymentAmountUsd } from '../../src/domain/chart-service/index.ts';
import { useAdminActionConfirmation } from './admin-action-confirmation-dialog';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { formatAdminDisplayId, getAdminDisplaySequence } from './admin-display-id';
import { canSubmitAdminOperationNote, normalizeAdminOperationNote } from './admin-operation-note';
import { formatAdminPlanPeriodLabel } from './admin-plan-labels';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
import { AdminRefreshButton } from './admin-refresh-button';
import { dispatchAdminRefreshEvent, subscribeAdminRefreshEvent } from './admin-refresh-events';
import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  getAdminSubscriptionFlowBadge,
} from './admin-status-labels';
import {
  filterSubscriptionQueueItems,
  getSubscriptionQueueFilterCount,
  getSubscriptionQueueFilterPreset,
  SUBSCRIPTION_QUEUE_FILTER_PRESETS,
} from './subscription-queue-filters';
import { getAdminSubscriptionDomId } from './subscription-links';

type AdminSubscriptionQueueItem = {
  subscription: {
    id: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    updatedAt: string;
  };
  user: {
    email: string;
    name: string;
  };
  plan: {
    id?: string | null;
    name: string;
    durationDays?: number | null;
  } | null;
  payment: {
    id: string;
    status: string;
    amountUsd: number;
  } | null;
};

type SubscriptionAdminPanelRefreshOptions = {
  nextMessage?: string;
};

type SubscriptionQuickMemo = {
  key: string;
  label: string;
  note: string;
  supports: (item: AdminSubscriptionQueueItem) => boolean;
};

const SUBSCRIPTION_QUICK_MEMOS: SubscriptionQuickMemo[] = [
  {
    key: 'activation-approved',
    label: '구독 승인',
    note: '입금확인 완료 후 구독 활성화',
    supports: (item) => item.subscription.status === 'payment_requested',
  },
  {
    key: 'cancel-approved',
    label: '취소 승인',
    note: '취소 사유 확인 후 처리',
    supports: (item) => item.subscription.status === 'cancel_requested',
  },
  {
    key: 'refund-approved',
    label: '환불 승인',
    note: '환불 사유 확인 후 처리',
    supports: (item) => item.subscription.status === 'refund_requested',
  },
  {
    key: 'request-rejected',
    label: '요청 반려',
    note: '요청 사유 확인 불가',
    supports: (item) => item.subscription.status === 'cancel_requested' || item.subscription.status === 'refund_requested',
  },
];

export function SubscriptionAdminPanel() {
  const [items, setItems] = useState<AdminSubscriptionQueueItem[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [subscriptionOperationNotes, setSubscriptionOperationNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(
    '관리자 확인으로 구독 승인, 취소, 환불 요청을 처리합니다.',
  );
  const [isBusy, setIsBusy] = useState(false);
  const { confirmAdminAction, confirmationDialog } = useAdminActionConfirmation();

  useEffect(() => {
    void refresh();
    const unsubscribeRefresh = subscribeAdminRefreshEvent((detail) => {
      if (detail.source === 'subscriptions') return;
      void refresh();
    });
    const unsubscribeQueuePreset = subscribeAdminQueuePresetEvent((detail) => {
      if (detail.panel !== 'subscriptions') return;
      const dashboardFilter = getSubscriptionQueueFilterPreset(detail.presetKey);
      setActiveFilterKey(dashboardFilter.key);
      setDashboardFilterNotice(dashboardFilter.label);
      void refresh();
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeQueuePreset();
    };
  }, []);

  async function refresh(options: SubscriptionAdminPanelRefreshOptions = {}) {
    setIsBusy(true);
    const response = await fetch('/api/admin/subscriptions');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setItems([]);
      setMessage(payload.message || '관리자 로그인이 필요합니다.');
      return;
    }
    setItems(payload.subscriptions || []);
    setMessage(options.nextMessage ?? `구독 요청 ${payload.subscriptions.length}건을 불러왔습니다.`);
  }

  async function runOperation(subscriptionId: string, action: 'approve' | 'cancel' | 'refund' | 'reject') {
    const adminNote = normalizeAdminOperationNote(subscriptionOperationNotes[subscriptionId] || '');
    if (action !== 'approve' && !canSubmitAdminOperationNote(adminNote)) {
      setMessage('관리자 처리 메모를 입력한 뒤 작업을 실행해주세요.');
      return;
    }
    if (!await confirmAdminAction(`subscription.${action}`, subscriptionId)) {
      return;
    }

    setIsBusy(true);
    const endpointByAction = {
      approve: '/api/admin/subscriptions/approve',
      cancel: '/api/admin/subscriptions/cancel',
      refund: '/api/admin/subscriptions/refund',
      reject: '/api/admin/subscriptions/reject',
    };
    const response = await fetch(endpointByAction[action], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        adminNote: adminNote || undefined,
      }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '구독 요청 처리에 실패했습니다.');
      return;
    }
    setSubscriptionOperationNotes((currentNotes) => ({ ...currentNotes, [subscriptionId]: '' }));
    void refresh({ nextMessage: `${subscriptionId} 요청을 처리했습니다. 목록을 갱신했습니다.` });
    dispatchAdminRefreshEvent({ source: 'subscriptions' });
  }

  function applyQuickFilter(presetKey: string) {
    setDashboardFilterNotice(null);
    setActiveFilterKey(presetKey);
  }

  function clearDashboardFilterNotice() {
    setDashboardFilterNotice(null);
    setActiveFilterKey('all');
  }

  function applyQuickMemo(subscriptionId: string, note: string) {
    setSubscriptionOperationNotes((currentNotes) => ({
      ...currentNotes,
      [subscriptionId]: note,
    }));
  }

  function renderSubscriptionFlowStatus(item: AdminSubscriptionQueueItem) {
    const flowBadge = getAdminSubscriptionFlowBadge({
      subscriptionStatus: item.subscription.status,
      paymentStatus: item.payment?.status ?? null,
    });
    const badgeLines = flowBadge.label.split(/\s*·\s*|\/+/);

    return (
      <div className="manual-flow-cell">
        <span className={`badge manual-flow-badge ${flowBadge.tone}`}>
          {badgeLines.map((line) => <span key={line}>{line}</span>)}
        </span>
        <small className="manual-flow-description">{flowBadge.description}</small>
        <small className="manual-flow-raw-status">
          구독 상태: {formatSubscriptionStatusLabel(item.subscription.status)}
        </small>
      </div>
    );
  }

  function renderSubscriptionPaymentCell(item: AdminSubscriptionQueueItem, paymentDisplayId?: string) {
    return item.payment ? (
      <>
        <strong title={item.payment.id}>{paymentDisplayId ?? item.payment.id}</strong>
        <span className="admin-subscription-payment-meta">
          <span>{formatPaymentStatusLabel(item.payment.status)}</span>
          <span>{formatPaymentAmountUsd(item.payment.amountUsd)}</span>
        </span>
      </>
    ) : (
      <span className="admin-subscription-empty-text">결제 없음</span>
    );
  }

  function renderSubscriptionActionControls(
    item: AdminSubscriptionQueueItem,
    currentNote: string,
    canSubmitNote: boolean,
    quickMemos: SubscriptionQuickMemo[],
  ) {
    return (
      <>
        <input
          aria-label={`${item.subscription.id} 관리자 처리 메모`}
          className="admin-note-input"
          placeholder="메모"
          value={currentNote}
          onChange={(event) => {
            const nextNote = event.currentTarget.value;
            setSubscriptionOperationNotes((currentNotes) => ({
              ...currentNotes,
              [item.subscription.id]: nextNote,
            }));
          }}
        />
        {quickMemos.length > 0 && (
          <div className="quick-memo-row" aria-label={`${item.subscription.id} 빠른 메모`}>
            <span>빠른 메모</span>
            {quickMemos.map((memo) => (
              <button
                className="quick-memo-button"
                type="button"
                key={memo.key}
                onClick={() => applyQuickMemo(item.subscription.id, memo.note)}
              >
                {memo.label}
              </button>
            ))}
          </div>
        )}
        <div className="actions compact">
          {item.subscription.status === 'payment_requested' && (
            <button
              className="button"
              type="button"
              onClick={() => runOperation(item.subscription.id, 'approve')}
              disabled={isBusy}
            >
              구독 승인
            </button>
          )}
          {item.subscription.status === 'cancel_requested' && (
            <button
              className="button secondary"
              type="button"
              onClick={() => runOperation(item.subscription.id, 'cancel')}
              disabled={isBusy || !canSubmitNote}
            >
              취소 승인
            </button>
          )}
          {item.subscription.status === 'refund_requested' && (
            <button
              className="button danger"
              type="button"
              onClick={() => runOperation(item.subscription.id, 'refund')}
              disabled={isBusy || !canSubmitNote}
            >
              환불 승인
            </button>
          )}
          {(item.subscription.status === 'cancel_requested' ||
            item.subscription.status === 'refund_requested') && (
            <button
              className="button secondary"
              type="button"
              onClick={() => runOperation(item.subscription.id, 'reject')}
              disabled={isBusy || !canSubmitNote}
            >
              반려
            </button>
          )}
        </div>
      </>
    );
  }

  const activeFilter = getSubscriptionQueueFilterPreset(activeFilterKey);
  const filteredItems = filterSubscriptionQueueItems(items, activeFilterKey);

  return (
    <>
      <section className="card wide" id="admin-subscriptions">
        <div className="toolbar">
          <h2>구독관리</h2>
          <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
        </div>
        <p className="notice">{message}</p>
        <div className="quick-filter-row" aria-label="구독 요청 빠른 필터">
          {SUBSCRIPTION_QUEUE_FILTER_PRESETS.map((preset) => {
            const isActive = activeFilter.key === preset.key;
            return (
              <button
                className={`button secondary${isActive ? ' active' : ''}`}
                type="button"
                key={preset.key}
                aria-pressed={isActive}
                onClick={() => applyQuickFilter(preset.key)}
              >
                <span>{preset.label}</span>
                <strong className="quick-filter-count">
                  {getSubscriptionQueueFilterCount(items, preset.key)}
                </strong>
              </button>
            );
          })}
        </div>
        <AdminDashboardFilterNotice
          label={dashboardFilterNotice}
          onClear={clearDashboardFilterNotice}
        />
        <p className="notice compact">
          현재 필터: {activeFilter.label} / 표시 {filteredItems.length}건
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>구독 ID</th>
              <th>회원</th>
              <th>플랜</th>
              <th>상태</th>
              <th>결제</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const currentNote = subscriptionOperationNotes[item.subscription.id] || '';
              const canSubmitNote = canSubmitAdminOperationNote(currentNote);
              const quickMemos = SUBSCRIPTION_QUICK_MEMOS.filter((memo) => memo.supports(item));
              const subscriptionDisplayId = formatAdminDisplayId(
                '구독',
                getAdminDisplaySequence(items, (queueItem) => queueItem.subscription.id === item.subscription.id),
              );
              const paymentDisplayId = item.payment
                ? formatAdminDisplayId(
                  '결제',
                  getAdminDisplaySequence(
                    items.filter((queueItem) => queueItem.payment),
                    (queueItem) => queueItem.payment?.id === item.payment?.id,
                  ),
                )
                : undefined;
              const [updatedDateLabel, updatedTimeLabel] = formatSubscriptionDateTimeParts(item.subscription.updatedAt);

              return (
                <tr
                  className="admin-subscription-row"
                  id={getAdminSubscriptionDomId(item.subscription.id)}
                  key={item.subscription.id}
                >
                  <td className="admin-subscription-id-cell">
                    <strong title={item.subscription.id}>{subscriptionDisplayId}</strong>
                    <span className="admin-subscription-id-meta">
                      <span>갱신</span>
                      <time dateTime={item.subscription.updatedAt} className="admin-subscription-date-stack">
                        <span>{updatedDateLabel}</span>
                        <span>{updatedTimeLabel}</span>
                      </time>
                    </span>
                  </td>
                  <td className="admin-subscription-member-cell">
                    <strong>{item.user.email}</strong>
                    <span>{item.user.name}</span>
                  </td>
                  <td className="admin-subscription-plan-cell">
                    <strong>{formatAdminPlanPeriodLabel(item.plan)}</strong>
                    {item.subscription.startsAt && (
                      <span>시작 {formatSubscriptionDateTime(item.subscription.startsAt)}</span>
                    )}
                    {item.subscription.endsAt && (
                      <span>만료 {formatSubscriptionDateTime(item.subscription.endsAt)}</span>
                    )}
                  </td>
                  <td className="admin-subscription-status-cell">{renderSubscriptionFlowStatus(item)}</td>
                  <td className="admin-subscription-payment-cell">
                    {renderSubscriptionPaymentCell(item, paymentDisplayId)}
                  </td>
                  <td className="admin-subscription-action-cell">
                    {renderSubscriptionActionControls(item, currentNote, canSubmitNote, quickMemos)}
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6}>대기 중인 구독 요청이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="admin-subscription-mobile-list" aria-label="모바일 구독관리 카드 목록">
          {filteredItems.map((item) => {
            const currentNote = subscriptionOperationNotes[item.subscription.id] || '';
            const canSubmitNote = canSubmitAdminOperationNote(currentNote);
            const quickMemos = SUBSCRIPTION_QUICK_MEMOS.filter((memo) => memo.supports(item));
            const subscriptionDisplayId = formatAdminDisplayId(
              '구독',
              getAdminDisplaySequence(items, (queueItem) => queueItem.subscription.id === item.subscription.id),
            );
            const paymentDisplayId = item.payment
              ? formatAdminDisplayId(
                '결제',
                getAdminDisplaySequence(
                  items.filter((queueItem) => queueItem.payment),
                  (queueItem) => queueItem.payment?.id === item.payment?.id,
                ),
              )
              : undefined;

            return (
              <article className="admin-subscription-mobile-card" key={`mobile-${item.subscription.id}`}>
                <div className="admin-subscription-mobile-card-title-row">
                  <div>
                    <strong title={item.subscription.id}>{subscriptionDisplayId}</strong>
                    <small>갱신 {formatSubscriptionDateTime(item.subscription.updatedAt)}</small>
                  </div>
                  <span className="badge manual-flow-badge">{formatSubscriptionStatusLabel(item.subscription.status)}</span>
                </div>
                <div className="admin-subscription-mobile-card-status-row">
                  {renderSubscriptionFlowStatus(item)}
                </div>
                <dl className="admin-subscription-mobile-card-info-grid">
                  <div>
                    <dt>회원</dt>
                    <dd>{item.user.email}</dd>
                  </div>
                  <div>
                    <dt>이름</dt>
                    <dd>{item.user.name}</dd>
                  </div>
                  <div>
                    <dt>플랜</dt>
                    <dd>{formatAdminPlanPeriodLabel(item.plan)}</dd>
                  </div>
                  <div>
                    <dt>결제</dt>
                    <dd>
                      {item.payment
                        ? `${paymentDisplayId} · ${formatPaymentAmountUsd(item.payment.amountUsd)}`
                        : '결제 없음'}
                    </dd>
                  </div>
                  {item.subscription.startsAt && (
                    <div>
                      <dt>시작</dt>
                      <dd>{formatSubscriptionDateTime(item.subscription.startsAt)}</dd>
                    </div>
                  )}
                  {item.subscription.endsAt && (
                    <div>
                      <dt>만료</dt>
                      <dd>{formatSubscriptionDateTime(item.subscription.endsAt)}</dd>
                    </div>
                  )}
                </dl>
                <div className="admin-subscription-mobile-card-payment">
                  {renderSubscriptionPaymentCell(item, paymentDisplayId)}
                </div>
                <div className="admin-subscription-mobile-card-actions">
                  {renderSubscriptionActionControls(item, currentNote, canSubmitNote, quickMemos)}
                </div>
              </article>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="admin-subscription-mobile-empty">대기 중인 구독 요청이 없습니다.</p>
          )}
        </div>
      </section>
      {confirmationDialog}
    </>
  );
}

function formatSubscriptionDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatSubscriptionDateTimeParts(value: string): [string, string] {
  const date = new Date(value);
  return [
    new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
    }).format(date),
    new Intl.DateTimeFormat('ko-KR', {
      timeStyle: 'short',
    }).format(date),
  ];
}
