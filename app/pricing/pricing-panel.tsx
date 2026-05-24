'use client';

import { useState } from 'react';
import { dispatchNotificationsRefreshEvent } from '../notification-events';

type Plan = {
  id: string;
  name: string;
  durationDays: number;
  basePriceUsd: number;
  discountPercent: number;
};

type PaymentTransferSettings = {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankLogoUrl: string;
  usdtAddress: string;
  usdtNetwork: string;
};

type PaymentResult = {
  payment?: {
    id: string;
    status: string;
    amountUsd: number;
  };
  message?: string;
};

export function PricingPanel({
  plans,
  paymentSettings,
}: {
  plans: Plan[];
  paymentSettings: PaymentTransferSettings;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? 'plan_monthly');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'usdt'>('bank_transfer');
  const [depositorName, setDepositorName] = useState('');
  const [message, setMessage] = useState('로그인 후 입금확인 요청을 남기면 관리자 수동 입금 확인 후 승인합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/payments/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlanId,
        method: paymentMethod,
        depositorName,
      }),
    });
    const payload = await response.json() as PaymentResult;
    setIsSubmitting(false);
    if (response.ok && payload.payment) {
      dispatchNotificationsRefreshEvent();
      setMessage(`입금확인 요청 ${payload.payment.id}이 접수되었습니다. 관리자 수동 입금 확인 전까지 상태: ${payload.payment.status}`);
      return;
    }
    setMessage(payload.message || '결제 요청에 실패했습니다. 먼저 로그인해 주세요.');
  }

  return (
    <section className="card">
      <form className="form" onSubmit={requestPayment}>
        <span className="form-section-label">구독 플랜</span>
        <div className="plan-card-grid" role="radiogroup" aria-label="구독 플랜 선택">
          {plans.map((plan) => (
            <label
              className={`plan-card${selectedPlanId === plan.id ? ' selected' : ''}`}
              key={plan.id}
            >
              <input
                type="radio"
                name="planId"
                value={plan.id}
                checked={selectedPlanId === plan.id}
                onChange={() => setSelectedPlanId(plan.id)}
              />
              <span className="plan-card-kicker">{plan.durationDays}일 이용권</span>
              <strong>{plan.name}</strong>
              <span className="plan-card-price">${discountedAmount(plan)}</span>
              <span className="plan-card-meta">
                정가 ${plan.basePriceUsd}
                {plan.discountPercent > 0 ? ` / ${plan.discountPercent}% 할인` : ' / 기본가'}
              </span>
            </label>
          ))}
        </div>
        <label htmlFor="paymentMethod">결제 방식</label>
        <select
          id="paymentMethod"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value === 'usdt' ? 'usdt' : 'bank_transfer')}
        >
          <option value="bank_transfer">은행 입금</option>
          <option value="usdt">USDT 테더 이체</option>
        </select>
        <div className="payment-transfer-info">
          {paymentMethod === 'bank_transfer' ? (
            <>
              <strong>은행 입금 정보</strong>
              <img
                alt={`${paymentSettings.bankName} 로고`}
                className="bank-logo-image"
                src={paymentSettings.bankLogoUrl}
              />
              <span>은행: {paymentSettings.bankName}</span>
              <span>계좌번호: {paymentSettings.bankAccountNumber}</span>
              <span>계좌주: {paymentSettings.bankAccountHolder}</span>
            </>
          ) : (
            <>
              <strong>USDT 테더 이체 정보</strong>
              <span>테더주소: {paymentSettings.usdtAddress}</span>
              <span>네트워크: {paymentSettings.usdtNetwork}</span>
            </>
          )}
        </div>
        <label htmlFor="depositorName">입금자명</label>
        <input
          id="depositorName"
          value={depositorName}
          onChange={(event) => setDepositorName(event.target.value)}
          placeholder="입금자명을 입력하세요"
        />
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '요청 중' : '입금 확인 요청'}
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

function discountedAmount(plan: Plan): number {
  return Math.round(plan.basePriceUsd * (1 - plan.discountPercent / 100) * 100) / 100;
}
