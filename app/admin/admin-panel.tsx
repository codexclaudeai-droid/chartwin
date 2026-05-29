'use client';

import { useEffect, useState } from 'react';
import { useAdminActionConfirmation } from './admin-action-confirmation-dialog';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { canSubmitAdminOperationNote, normalizeAdminOperationNote } from './admin-operation-note';
import { formatAdminPlanPeriodLabel } from './admin-plan-labels';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
import { dispatchAdminRefreshEvent, subscribeAdminRefreshEvent } from './admin-refresh-events';
import {
  formatPaymentStatusLabel,
  getAdminPaymentFlowBadge,
} from './admin-status-labels';
import {
  filterPaymentQueueItems,
  getPaymentQueueFilterCount,
  getPaymentQueueFilterPreset,
  PAYMENT_QUEUE_FILTER_PRESETS,
} from './payment-queue-filters';
import { getAdminPaymentDomId } from './payment-links';
import { createAdminSupportThreadUrl } from './support-thread-links';
import { createTronScanTransactionUrl } from './tronscan-links';

type AdminPaymentQueueItem = {
  payment: {
    id: string;
    status: string;
    method: string;
    amountUsd: number;
    depositorName: string | null;
    transactionId: string | null;
    transactionVerificationStatus: 'unchecked' | 'verified' | 'mismatch' | 'failed';
    transactionVerificationMessage: string | null;
    transactionVerifiedAt: string | null;
    createdAt: string;
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
  subscription: {
    status: string;
  } | null;
  supportThread: {
    id: string;
    title: string;
  } | null;
};

type AdminPanelRefreshOptions = {
  nextMessage?: string;
};

type PaymentQuickMemo = {
  key: string;
  label: string;
  note: string;
  supports: (item: AdminPaymentQueueItem) => boolean;
};

const PAYMENT_QUICK_MEMOS: PaymentQuickMemo[] = [
  {
    key: 'bank-confirmed',
    label: '은행 입금 확인',
    note: '입금자명/금액 일치 확인',
    supports: (item) => (item.payment.status === 'pending' || item.payment.status === 'requested') && item.payment.method !== 'usdt',
  },
  {
    key: 'txid-confirmed',
    label: 'TXID 확인',
    note: 'TXID 수신주소/금액 일치 확인',
    supports: (item) => (item.payment.status === 'pending' || item.payment.status === 'requested') && item.payment.method === 'usdt',
  },
  {
    key: 'deposit-rejected',
    label: '입금 반려',
    note: '입금 내역 확인 불가',
    supports: (item) => item.payment.status === 'pending' || item.payment.status === 'requested',
  },
  {
    key: 'refund-processed',
    label: '환불 처리',
    note: '환불 사유 확인 후 처리',
    supports: (item) => item.payment.status === 'confirmed',
  },
];

function formatAdminPaymentMethodLabel(method: string): string {
  if (method === 'usdt') return 'USDT';
  if (method === 'bank_transfer') return '은행이체';
  return method;
}

function formatAdminPaymentDateTime(value: string): string {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactTransactionId(transactionId: string): string {
  return transactionId.length > 22
    ? `${transactionId.slice(0, 10)}...${transactionId.slice(-8)}`
    : transactionId;
}

export function AdminPanel() {
  const [payments, setPayments] = useState<AdminPaymentQueueItem[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [operationNotes, setOperationNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('관리자 계정으로 로그인하면 결제 요청 큐를 불러옵니다.');
  const [isBusy, setIsBusy] = useState(false);
  const { confirmAdminAction, confirmationDialog } = useAdminActionConfirmation();

  useEffect(() => {
    void refresh();
    const unsubscribeRefresh = subscribeAdminRefreshEvent((detail) => {
      if (detail.source === 'payments') return;
      void refresh();
    });
    const unsubscribeQueuePreset = subscribeAdminQueuePresetEvent((detail) => {
      if (detail.panel !== 'payments') return;
      const dashboardFilter = getPaymentQueueFilterPreset(detail.presetKey);
      setActiveFilterKey(dashboardFilter.key);
      setDashboardFilterNotice(dashboardFilter.label);
      void refresh();
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeQueuePreset();
    };
  }, []);

  async function refresh(options: AdminPanelRefreshOptions = {}) {
    setIsBusy(true);
    const response = await fetch('/api/admin/payments');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '관리자 로그인이 필요합니다.');
      setPayments([]);
      return;
    }
    setPayments(payload.payments);
    setMessage(options.nextMessage ?? `결제 요청 ${payload.payments.length}건을 불러왔습니다.`);
  }

  async function runOperation(paymentId: string, operation: 'confirm' | 'refund' | 'reject') {
    const adminNote = normalizeAdminOperationNote(operationNotes[paymentId] || '');
    if (!canSubmitAdminOperationNote(adminNote)) {
      setMessage('관리자 처리 메모를 입력한 뒤 작업을 실행해주세요.');
      return;
    }
    if (!await confirmAdminAction(`payment.${operation}`, paymentId)) {
      return;
    }

    setIsBusy(true);
    const endpointByOperation = {
      confirm: '/api/admin/payments/confirm',
      refund: '/api/admin/payments/refund',
      reject: '/api/admin/payments/reject',
    };
    const response = await fetch(endpointByOperation[operation], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        adminNote,
      }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '관리자 작업에 실패했습니다.');
      return;
    }
    setOperationNotes((currentNotes) => ({ ...currentNotes, [paymentId]: '' }));
    void refresh({ nextMessage: `${paymentId} 작업이 반영되었습니다. 목록을 갱신했습니다.` });
    dispatchAdminRefreshEvent({ source: 'payments' });
  }

  async function verifyTransactionId(paymentId: string) {
    setIsBusy(true);
    const response = await fetch('/api/admin/payments/verify-txid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || 'TronScan TXID 확인에 실패했습니다.');
      return;
    }
    void refresh({ nextMessage: `${paymentId} TronScan 확인상태를 갱신했습니다.` });
    dispatchAdminRefreshEvent({ source: 'payments' });
  }

  function applyQuickFilter(presetKey: string) {
    setDashboardFilterNotice(null);
    setActiveFilterKey(presetKey);
  }

  function clearDashboardFilterNotice() {
    setDashboardFilterNotice(null);
    setActiveFilterKey('all');
  }

  function applyQuickMemo(paymentId: string, note: string) {
    setOperationNotes((currentNotes) => ({
      ...currentNotes,
      [paymentId]: note,
    }));
  }

  function renderPaymentFlowStatus(item: AdminPaymentQueueItem) {
    const flowBadge = getAdminPaymentFlowBadge({
      paymentStatus: item.payment.status,
      subscriptionStatus: item.subscription?.status ?? null,
    });

    return (
      <div className="manual-flow-cell">
        <span className={`badge manual-flow-badge ${flowBadge.tone}`}>{flowBadge.label}</span>
        <small className="manual-flow-description">{flowBadge.description}</small>
        <small className="manual-flow-raw-status">결제 상태: {formatPaymentStatusLabel(item.payment.status)}</small>
      </div>
    );
  }

  function renderTransactionVerificationBadge(item: AdminPaymentQueueItem) {
    const status = item.payment.transactionVerificationStatus ?? 'unchecked';
    const labels = {
      unchecked: 'TXID 확인 전',
      verified: 'TronScan 확인 완료',
      mismatch: 'TronScan 불일치',
      failed: 'TronScan 조회 실패',
    };

    return (
      <span className={`badge txid-verification-badge ${status}`}>
        {labels[status]}
      </span>
    );
  }

  const activeFilter = getPaymentQueueFilterPreset(activeFilterKey);
  const filteredPayments = filterPaymentQueueItems(payments, activeFilterKey);

  return (
    <>
    <section className="card wide" id="admin-payments">
      <div className="toolbar">
        <h2>결제 요청 관리</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <p className="notice">{message}</p>
      <div className="quick-filter-row" aria-label="결제 요청 빠른 필터">
        {PAYMENT_QUEUE_FILTER_PRESETS.map((preset) => {
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
              <strong className="quick-filter-count">{getPaymentQueueFilterCount(payments, preset.key)}</strong>
            </button>
          );
        })}
      </div>
      <AdminDashboardFilterNotice
        label={dashboardFilterNotice}
        onClear={clearDashboardFilterNotice}
      />
      <p className="notice compact">현재 필터: {activeFilter.label} / 표시 {filteredPayments.length}건</p>
      <table className="table">
        <thead>
          <tr>
            <th>결제 ID</th>
            <th>회원</th>
            <th>플랜</th>
            <th>금액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {filteredPayments.map((item) => (
            <tr className="admin-payment-row" id={getAdminPaymentDomId(item.payment.id)} key={item.payment.id}>
              <td className="admin-payment-id-cell">
                <strong>{item.payment.id}</strong>
                <span>
                  {formatAdminPaymentMethodLabel(item.payment.method)} · {formatAdminPaymentDateTime(item.payment.createdAt)}
                </span>
                {item.supportThread && (
                  <a className="text-link compact" href={createAdminSupportThreadUrl(item.supportThread.id)}>
                    입금확인 요청글
                  </a>
                )}
              </td>
              <td className="admin-payment-member-cell">
                <strong>{item.user.email}</strong>
                <span>{item.payment.depositorName || item.user.name}</span>
                {item.payment.transactionId && (
                  <div className="admin-payment-txid-box">
                    <small title={item.payment.transactionId}>
                      TXID {formatCompactTransactionId(item.payment.transactionId)}
                    </small>
                    {renderTransactionVerificationBadge(item)}
                    {item.payment.transactionVerificationMessage && (
                      <small>{item.payment.transactionVerificationMessage}</small>
                    )}
                    {item.payment.transactionVerifiedAt && (
                      <small>확인 {formatAdminPaymentDateTime(item.payment.transactionVerifiedAt)}</small>
                    )}
                    <a
                      className="text-link compact"
                      href={createTronScanTransactionUrl(item.payment.transactionId)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      TronScan
                    </a>
                  </div>
                )}
              </td>
              <td className="admin-payment-plan-cell"><strong>{formatAdminPlanPeriodLabel(item.plan)}</strong></td>
              <td className="admin-payment-amount-cell">${item.payment.amountUsd}</td>
              <td className="admin-payment-status-cell">{renderPaymentFlowStatus(item)}</td>
              <td className="admin-payment-action-cell">
                <input
                  aria-label={`${item.payment.id} 관리자 처리 메모`}
                  className="admin-note-input"
                  onChange={(event) => setOperationNotes((currentNotes) => ({
                    ...currentNotes,
                    [item.payment.id]: event.target.value,
                  }))}
                  placeholder="처리 메모 입력"
                  value={operationNotes[item.payment.id] || ''}
                />
                <div className="quick-memo-row" aria-label={`${item.payment.id} 빠른 메모`}>
                  <span>빠른 메모</span>
                  {PAYMENT_QUICK_MEMOS.filter((memo) => memo.supports(item)).map((memo) => (
                    <button
                      className="quick-memo-button"
                      key={memo.key}
                      onClick={() => applyQuickMemo(item.payment.id, memo.note)}
                      type="button"
                    >
                      {memo.label}
                    </button>
                  ))}
                </div>
                <div className="actions compact">
                  {(item.payment.status === 'pending' || item.payment.status === 'requested') && (
                    <button className="button" type="button" onClick={() => runOperation(item.payment.id, 'confirm')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.payment.id] || '')}>
                      입금 확인
                    </button>
                  )}
                  {item.payment.status === 'confirmed' && (
                    <button className="button danger" type="button" onClick={() => runOperation(item.payment.id, 'refund')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.payment.id] || '')}>
                      환불
                    </button>
                  )}
                  {(item.payment.status === 'pending' || item.payment.status === 'requested') && (
                    <button className="button secondary" type="button" onClick={() => runOperation(item.payment.id, 'reject')} disabled={isBusy || !canSubmitAdminOperationNote(operationNotes[item.payment.id] || '')}>
                      반려
                    </button>
                  )}
                  {item.payment.method === 'usdt' && item.payment.transactionId && (
                    <button className="button secondary" type="button" onClick={() => verifyTransactionId(item.payment.id)} disabled={isBusy}>
                      다시 확인
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filteredPayments.length === 0 && (
            <tr>
              <td colSpan={6}>표시할 결제 요청이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
    {confirmationDialog}
    </>
  );
}
