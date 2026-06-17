'use client';

import { useEffect, useState } from 'react';
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

type AdminPaymentOperationOptions = {
  defaultAdminNote?: string;
  provisionalSale?: boolean;
};

type PaymentQuickMemo = {
  key: string;
  label: string;
  note: string;
  supports: (item: AdminPaymentQueueItem) => boolean;
};

const PAYMENT_QUICK_MEMOS: PaymentQuickMemo[] = [
  {
    key: 'deposit-confirmed',
    label: '입금확인',
    note: '입금 확인',
    supports: (item) => item.payment.status === 'pending' || item.payment.status === 'requested',
  },
  {
    key: 'deposit-rejected',
    label: '미입금/반려',
    note: '미입금/반려',
    supports: (item) => item.payment.status === 'pending' || item.payment.status === 'requested',
  },
];
const ADMIN_PAYMENT_PAGE_SIZE = 10;
const ADMIN_PAYMENT_PAGE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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
  const [currentPaymentPage, setCurrentPaymentPage] = useState(1);
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

  useEffect(() => {
    setCurrentPaymentPage(1);
  }, [activeFilterKey]);

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

  async function runOperation(
    paymentId: string,
    operation: 'confirm' | 'refund' | 'reject',
    options: AdminPaymentOperationOptions = {},
  ) {
    const adminNote = normalizeAdminOperationNote(operationNotes[paymentId] || options.defaultAdminNote || '');
    if (!canSubmitAdminOperationNote(adminNote)) {
      setMessage('관리자 처리 메모를 입력한 뒤 작업을 실행해주세요.');
      return;
    }
    const confirmationAction = options.provisionalSale ? 'payment.provisionalSale' : `payment.${operation}`;
    if (!await confirmAdminAction(confirmationAction, paymentId)) {
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
        provisionalSale: options.provisionalSale === true,
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
    const badgeLines = flowBadge.label.split(/\s*·\s*|\/+/);

    return (
      <div className="manual-flow-cell">
        <span className={`badge manual-flow-badge ${flowBadge.tone}`}>
          {badgeLines.map((line) => <span key={line}>{line}</span>)}
        </span>
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

  function renderPaymentTransactionBox(item: AdminPaymentQueueItem) {
    if (!item.payment.transactionId) return null;

    return (
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
    );
  }

  function renderPaymentActionControls(item: AdminPaymentQueueItem) {
    return (
      <>
        <input
          aria-label={`${item.payment.id} 관리자 처리 메모`}
          className="admin-note-input"
          onChange={(event) => setOperationNotes((currentNotes) => ({
            ...currentNotes,
            [item.payment.id]: event.target.value,
          }))}
          placeholder="메모"
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
          {(item.payment.status === 'pending' || item.payment.status === 'requested') && (
            <button
              className="button secondary"
              type="button"
              onClick={() => runOperation(item.payment.id, 'confirm', {
                defaultAdminNote: '가매출승인',
                provisionalSale: true,
              })}
              disabled={isBusy}
            >
              가매출승인
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
      </>
    );
  }

  const activeFilter = getPaymentQueueFilterPreset(activeFilterKey);
  const filteredPayments = filterPaymentQueueItems(payments, activeFilterKey);
  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / ADMIN_PAYMENT_PAGE_SIZE));
  const safeCurrentPaymentPage = Math.min(currentPaymentPage, paymentPageCount);
  const paginatedPayments = filteredPayments.slice(
    (safeCurrentPaymentPage - 1) * ADMIN_PAYMENT_PAGE_SIZE,
    safeCurrentPaymentPage * ADMIN_PAYMENT_PAGE_SIZE,
  );

  return (
    <>
    <section className="card wide" id="admin-payments">
      <div className="toolbar">
        <h2>입금관리</h2>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
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
          {paginatedPayments.map((item) => {
            const paymentDisplayId = formatAdminDisplayId(
              '결제',
              getAdminDisplaySequence(payments, (paymentItem) => paymentItem.payment.id === item.payment.id),
            );

            return (
            <tr className="admin-payment-row" id={getAdminPaymentDomId(item.payment.id)} key={item.payment.id}>
              <td className="admin-payment-id-cell">
                <strong title={item.payment.id}>{paymentDisplayId}</strong>
                <span className="admin-payment-id-meta">
                  <span>{formatAdminPaymentMethodLabel(item.payment.method)}</span>
                  <span>{formatAdminPaymentDateTime(item.payment.createdAt)}</span>
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
                {renderPaymentTransactionBox(item)}
              </td>
              <td className="admin-payment-plan-cell"><strong>{formatAdminPlanPeriodLabel(item.plan)}</strong></td>
              <td className="admin-payment-amount-cell">${item.payment.amountUsd}</td>
              <td className="admin-payment-status-cell">{renderPaymentFlowStatus(item)}</td>
              <td className="admin-payment-action-cell">
                {renderPaymentActionControls(item)}
              </td>
            </tr>
            );
          })}
          {filteredPayments.length === 0 && (
            <tr>
              <td colSpan={6}>표시할 결제 요청이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="admin-payment-mobile-list" aria-label="모바일 입금관리 카드 목록">
        {paginatedPayments.map((item) => {
          const paymentDisplayId = formatAdminDisplayId(
            '결제',
            getAdminDisplaySequence(payments, (paymentItem) => paymentItem.payment.id === item.payment.id),
          );

          return (
          <article className="admin-payment-mobile-card" key={`mobile-${item.payment.id}`}>
            <div className="admin-payment-mobile-card-title-row">
              <div>
                <strong title={item.payment.id}>{paymentDisplayId}</strong>
                <small>{formatAdminPaymentMethodLabel(item.payment.method)} · {formatAdminPaymentDateTime(item.payment.createdAt)}</small>
              </div>
              <span className="admin-payment-amount-cell">${item.payment.amountUsd}</span>
            </div>
            <div className="admin-payment-mobile-card-status-row">
              {renderPaymentFlowStatus(item)}
            </div>
            <dl className="admin-payment-mobile-card-info-grid">
              <div>
                <dt>회원</dt>
                <dd>{item.user.email}</dd>
              </div>
              <div>
                <dt>입금자</dt>
                <dd>{item.payment.depositorName || item.user.name}</dd>
              </div>
              <div>
                <dt>플랜</dt>
                <dd>{formatAdminPlanPeriodLabel(item.plan)}</dd>
              </div>
              <div>
                <dt>금액</dt>
                <dd>${item.payment.amountUsd}</dd>
              </div>
            </dl>
            {renderPaymentTransactionBox(item)}
            {item.supportThread && (
              <a className="text-link compact" href={createAdminSupportThreadUrl(item.supportThread.id)}>
                입금확인 요청글
              </a>
            )}
            <div className="admin-payment-mobile-card-actions">
              {renderPaymentActionControls(item)}
            </div>
          </article>
          );
        })}
        {filteredPayments.length === 0 && (
          <p className="admin-payment-mobile-empty">표시할 결제 요청이 없습니다.</p>
        )}
      </div>
      {filteredPayments.length > ADMIN_PAYMENT_PAGE_SIZE ? (
        <nav className="admin-pagination" aria-label="입금관리 목록 페이지">
          {ADMIN_PAYMENT_PAGE_NUMBERS.filter((pageNumber) => pageNumber <= paymentPageCount).map((pageNumber) => (
            <button
              className={`admin-pagination-button${safeCurrentPaymentPage === pageNumber ? ' active' : ''}`}
              type="button"
              key={pageNumber}
              aria-current={safeCurrentPaymentPage === pageNumber ? 'page' : undefined}
              onClick={() => setCurrentPaymentPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </nav>
      ) : null}
    </section>
    {confirmationDialog}
    </>
  );
}
