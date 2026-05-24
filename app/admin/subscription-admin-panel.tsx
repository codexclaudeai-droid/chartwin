'use client';

import { useEffect, useState } from 'react';
import { useAdminActionConfirmation } from './admin-action-confirmation-dialog';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { canSubmitAdminOperationNote, normalizeAdminOperationNote } from './admin-operation-note';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
import { dispatchAdminRefreshEvent, subscribeAdminRefreshEvent } from './admin-refresh-events';
import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
} from './admin-status-labels';
import {
  filterSubscriptionQueueItems,
  getSubscriptionQueueFilterPreset,
  SUBSCRIPTION_QUEUE_FILTER_PRESETS,
} from './subscription-queue-filters';

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
    name: string;
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

export function SubscriptionAdminPanel() {
  const [items, setItems] = useState<AdminSubscriptionQueueItem[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [operationNotes, setOperationNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('관리자 세션으로 구독 승인, 취소, 환불 요청을 처리합니다.');
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
    const adminNote = normalizeAdminOperationNote(operationNotes[subscriptionId] || '');
    if (!canSubmitAdminOperationNote(adminNote)) {
      setMessage('관리자 처리 메모를 입력한 뒤 요청을 처리해주세요.');
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
        adminNote,
      }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '구독 요청 처리에 실패했습니다.');
      return;
    }
    setOperationNotes((currentNotes) => ({ ...currentNotes, [subscriptionId]: '' }));
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

  const activeFilter = getSubscriptionQueueFilterPreset(activeFilterKey);
  const filteredItems = filterSubscriptionQueueItems(items, activeFilterKey);

  return (
    <>
    <section className="card wide" id="admin-subscriptions">
      <div className="toolbar">
        <h2>구독 요청 관리</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>새로고침</button>
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
              {preset.label}
            </button>
          );
        })}
      </div>
      <AdminDashboardFilterNotice
        label={dashboardFilterNotice}
        onClear={clearDashboardFilterNotice}
      />
      <p className="notice compact">현재 필터: {activeFilter.label} / 표시 {filteredItems.length}건</p>
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
          {filteredItems.map((item) => (
            <tr key={item.subscription.id}>
              <td>{item.subscription.id}</td>
              <td>{item.user.email}<br /><small>{item.user.name}</small></td>
              <td>{item.plan?.name ?? '-'}</td>
              <td><span className="badge">{formatSubscriptionStatusLabel(item.subscription.status)}</span></td>
              <td>{item.payment ? `${item.payment.id} / ${formatPaymentStatusLabel(item.payment.status)}` : '-'}</td>
              <td>
                <input
                  aria-label={`${item.subscription.id} 관리자 처리 메모`}
                  className="admin-note-input"
                  onChange={(event) => setOperationNotes((currentNotes) => ({
                    ...currentNotes,
                    [item.subscription.id]: event.target.value,
                  }))}
                  placeholder="처리 메모 입력"
                  value={operationNotes[item.subscription.id] || ''}
                />
                <div className="actions compact">
                  {item.subscription.status === 'payment_requested' && (
                    <button className="button" type="button" onClick={() => runOperation(item.subscription.id, 'approve')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.subscription.id] || '')}>
                      구독 승인
                    </button>
                  )}
                  {item.subscription.status === 'cancel_requested' && (
                    <button className="button secondary" type="button" onClick={() => runOperation(item.subscription.id, 'cancel')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.subscription.id] || '')}>
                      취소 승인
                    </button>
                  )}
                  {item.subscription.status === 'refund_requested' && (
                    <button className="button danger" type="button" onClick={() => runOperation(item.subscription.id, 'refund')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.subscription.id] || '')}>
                      환불 승인
                    </button>
                  )}
                  {(item.subscription.status === 'cancel_requested' || item.subscription.status === 'refund_requested') && (
                    <button className="button secondary" type="button" onClick={() => runOperation(item.subscription.id, 'reject')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.subscription.id] || '')}>
                      반려
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filteredItems.length === 0 && (
            <tr>
              <td colSpan={6}>대기 중인 구독 요청이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
    {confirmationDialog}
    </>
  );
}
