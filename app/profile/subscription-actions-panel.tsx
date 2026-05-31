'use client';

import { useEffect, useState } from 'react';
import { RefreshIconButton } from '../shared/refresh-icon-button';

type SubscriptionSnapshot = {
  id: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
} | null;

type AccessSnapshot = {
  role: string;
  subscriptionStatus: string;
  fullChart: boolean;
  paidSignals: boolean;
};

export function SubscriptionActionsPanel() {
  const [subscription, setSubscription] = useState<SubscriptionSnapshot>(null);
  const [access, setAccess] = useState<AccessSnapshot | null>(null);
  const [message, setMessage] = useState('로그인하면 내 구독 상태와 취소/환불 요청 버튼이 표시됩니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/subscription/me');
    const payload = await response.json();
    setIsBusy(false);
    setSubscription(payload.subscription ?? null);
    setAccess(payload.access ?? null);
  }

  async function requestAction(action: 'cancel' | 'refund') {
    setIsBusy(true);
    const endpoint = action === 'cancel'
      ? '/api/subscription/cancel-request'
      : '/api/subscription/refund-request';
    const response = await fetch(endpoint, { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '요청 처리에 실패했습니다.');
      return;
    }
    setSubscription(payload.subscription);
    setMessage(action === 'cancel'
      ? '구독 취소 요청이 관리자 확인 대기 상태로 접수되었습니다.'
      : '환불 요청이 관리자 확인 대기 상태로 접수되었습니다.');
  }

  return (
    <section className="card">
      <div className="toolbar">
        <h2>내 구독 상태</h2>
        <RefreshIconButton onClick={refresh} disabled={isBusy} />
      </div>
      <div className="status-list">
        <div className="status-row">
          <span>회원레벨</span>
          <strong>{access?.role ?? '-'}</strong>
        </div>
        <div className="status-row">
          <span>구독 상태</span>
          <strong>{subscription?.status ?? access?.subscriptionStatus ?? '-'}</strong>
        </div>
        <div className="status-row">
          <span>차트 접근</span>
          <strong>{access?.fullChart ? '허용' : '차단'}</strong>
        </div>
      </div>
      <div className="actions">
        <button className="button secondary" type="button" onClick={() => requestAction('cancel')} disabled={isBusy}>
          취소 요청
        </button>
        <button className="button danger" type="button" onClick={() => requestAction('refund')} disabled={isBusy}>
          환불 요청
        </button>
      </div>
      <p className="notice">{message}</p>
    </section>
  );
}
