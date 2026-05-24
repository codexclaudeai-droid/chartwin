'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from '../auth-events';
import {
  formatChartAccessLabel,
  formatPaymentAmountUsd,
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  type PaymentStatus,
  type SubscriptionStatus,
} from '../../src/domain/chart-service/index.ts';
import { createProfileImagePolicyPayload } from './profile-image-policy';
import { getProfilePaymentFlowSteps } from './profile-payment-flow';

type Dashboard = {
  user: {
    email: string;
    name: string;
    role: string;
  };
  access: {
    role: string;
    subscriptionStatus: SubscriptionStatus;
    fullChart: boolean;
    paidSignals: boolean;
  };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    startsAt: string | null;
    endsAt: string | null;
    updatedAt: string;
  } | null;
  payments: Array<{
    id: string;
    method: string;
    amountUsd: number;
    amountKrw: number | null;
    status: PaymentStatus;
    depositorName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  notifications: {
    totalCount: number;
    unreadCount: number;
  };
  support: {
    visibleThreadCount: number;
    waitingThreadCount: number;
  };
};

type ProfileResponse = {
  ok: boolean;
  message?: string;
  dashboard?: Dashboard;
};

export function ProfilePanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState('계정 정보를 불러오는 중입니다.');
  const [settingsMessage, setSettingsMessage] = useState('프로필 이름과 이미지 업로드 가능 여부를 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const [targetPaymentId, setTargetPaymentId] = useState(() => getTargetPaymentIdFromHash());

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeAuthSessionChangedEvent(() => {
      void refresh();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateTargetPaymentId = () => setTargetPaymentId(getTargetPaymentIdFromHash());

    updateTargetPaymentId();
    window.addEventListener('hashchange', updateTargetPaymentId);

    return () => window.removeEventListener('hashchange', updateTargetPaymentId);
  }, []);

  useEffect(() => {
    if (!targetPaymentId) return;

    const target = document.getElementById(`payment-${targetPaymentId}`);
    target?.scrollIntoView({ block: 'center' });
  }, [dashboard, targetPaymentId]);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/profile', { cache: 'no-store' });
    const payload = await response.json() as ProfileResponse;
    setIsBusy(false);

    if (!response.ok || !payload.dashboard) {
      setDashboard(null);
      setMessage(payload.message || '로그인 후 내 계정을 확인할 수 있습니다.');
      return;
    }

    setDashboard(payload.dashboard);
    setNameDraft(payload.dashboard.user.name);
    setMessage('최신 계정 상태를 불러왔습니다.');
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameDraft }),
    });
    const payload = await response.json() as ProfileResponse;
    setIsBusy(false);

    if (!response.ok || !payload.dashboard) {
      setSettingsMessage(payload.message || '프로필 수정에 실패했습니다.');
      return;
    }

    setDashboard(payload.dashboard);
    setNameDraft(payload.dashboard.user.name);
    setSettingsMessage('프로필 이름이 수정되었습니다.');
  }

  async function validateImagePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedImageFile) {
      setSettingsMessage('프로필 이미지 파일을 먼저 선택해주세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/profile/image-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createProfileImagePolicyPayload(selectedImageFile)),
    });
    const payload = await response.json();
    setIsBusy(false);

    setSettingsMessage(response.ok && payload.policy?.ok
      ? '프로필 이미지 업로드 정책을 통과했습니다. 실제 저장소 연결은 다음 단계에서 붙일 수 있습니다.'
      : `프로필 이미지 정책 실패: ${payload.policy?.reason || payload.message || 'unknown'}`);
  }

  if (!dashboard) {
    return (
      <section className="card wide">
        <div className="toolbar">
          <h2>계정 확인 필요</h2>
          <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
        </div>
        <p className="notice">{message}</p>
        <div className="actions">
          <Link className="button" href="/login">로그인</Link>
          <Link className="button secondary" href="/signup">회원가입</Link>
        </div>
      </section>
    );
  }

  const subscriptionStatus = dashboard.subscription?.status ?? dashboard.access.subscriptionStatus;
  const latestPayment = dashboard.payments[0] ?? null;

  return (
    <section className="profile-layout">
      <div className="card">
        <div className="toolbar">
          <h2>회원 정보</h2>
          <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
        </div>
        <div className="status-list">
          <div className="status-row">
            <span>이름</span>
            <strong>{dashboard.user.name}</strong>
          </div>
          <div className="status-row">
            <span>이메일</span>
            <strong>{dashboard.user.email}</strong>
          </div>
          <div className="status-row">
            <span>권한</span>
            <strong>{dashboard.user.role}</strong>
          </div>
        </div>
        <form className="form profile-settings-form" onSubmit={submitProfile}>
          <label htmlFor="profileName">표시 이름</label>
          <input
            id="profileName"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="표시 이름"
          />
          <button className="button" type="submit" disabled={isBusy}>프로필 저장</button>
        </form>
        <form className="form profile-settings-form" onSubmit={validateImagePolicy}>
          <label htmlFor="profileImageFile">프로필 이미지 파일</label>
          <input
            accept="image/png,image/jpeg,image/webp"
            id="profileImageFile"
            onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          {selectedImageFile && (
            <p className="notice">
              선택 파일: {selectedImageFile.name} / {selectedImageFile.type || 'unknown'} / {selectedImageFile.size} bytes
            </p>
          )}
          <button className="button secondary" type="submit" disabled={isBusy}>이미지 정책 확인</button>
        </form>
        <p className="notice">{settingsMessage}</p>
        <p className="notice">{message}</p>
      </div>

      <div className="card wide">
        <h2>서비스 상태</h2>
        <div className="summary-grid">
          <article className="mini-card">
            <span>구독</span>
            <strong>{formatSubscriptionStatusLabel(subscriptionStatus)}</strong>
            <p>{dashboard.subscription?.endsAt ? `만료일 ${formatDateTime(dashboard.subscription.endsAt)}` : '승인 전 구독은 관리자 확인 후 활성화됩니다.'}</p>
          </article>
          <article className="mini-card">
            <span>차트 접근</span>
            <strong>{formatChartAccessLabel(dashboard.access)}</strong>
            <p>차트: {dashboard.access.fullChart ? '허용' : '제한'} / 시그널: {dashboard.access.paidSignals ? '허용' : '제한'}</p>
          </article>
          <article className="mini-card">
            <span>알림</span>
            <strong>읽지 않음 {dashboard.notifications.unreadCount}건</strong>
            <p>총 {dashboard.notifications.totalCount}건의 처리 알림이 있습니다.</p>
          </article>
          <article className="mini-card">
            <span>고객센터</span>
            <strong>대기 {dashboard.support.waitingThreadCount}건</strong>
            <p>확인 가능한 문의 {dashboard.support.visibleThreadCount}건</p>
          </article>
        </div>
        <div className="actions">
          <Link className="button" href="/pricing">구독 관리</Link>
          <Link className="button secondary" href="/notifications">알림 보기</Link>
          <Link className="button secondary" href="/support">고객센터</Link>
        </div>
      </div>

      <div className="card wide">
        <h2>최근 결제 요청</h2>
        {latestPayment ? (
          <div className="payment-list">
            {dashboard.payments.slice(0, 3).map((payment) => (
              <article
                className={`payment-card${targetPaymentId === payment.id ? ' payment-card-target' : ''}`}
                id={`payment-${payment.id}`}
                key={payment.id}
              >
                <div className="payment-card-summary">
                  <div>
                    <strong>{payment.id}</strong>
                    <p>{formatPaymentAmountUsd(payment.amountUsd)} / {payment.method}</p>
                  </div>
                  <div>
                    <span className="badge">{formatPaymentStatusLabel(payment.status)}</span>
                    <p>{formatDateTime(payment.updatedAt)}</p>
                  </div>
                </div>
                <ol className="payment-flow-steps" aria-label={`${payment.id} 결제 진행 단계`}>
                  {getProfilePaymentFlowSteps({
                    paymentStatus: payment.status,
                    subscriptionStatus,
                  }).map((step) => (
                    <li className={`payment-flow-step ${step.state}`} key={step.key}>
                      <span>{step.label}</span>
                      <small>{step.description}</small>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">아직 결제 요청이 없습니다. 구독 페이지에서 입금 확인 요청을 접수할 수 있습니다.</p>
        )}
      </div>
    </section>
  );
}

function getTargetPaymentIdFromHash(): string | null {
  if (typeof window === 'undefined') return null;

  const prefix = '#payment-';
  const hash = window.location.hash;
  if (!hash.startsWith(prefix)) return null;

  return decodeURIComponent(hash.slice(prefix.length));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
