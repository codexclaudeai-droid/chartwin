'use client';

import { useEffect, useState } from 'react';
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

type ExchangeRateResult = {
  ok?: boolean;
  provider?: string;
  rate?: number;
  fetchedAt?: string;
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
  const [transactionId, setTransactionId] = useState('');
  const [naverExchangeRate, setNaverExchangeRate] = useState<number | null>(null);
  const [exchangeRateMessage, setExchangeRateMessage] = useState('네이버 환율을 불러오는 중입니다.');
  const [message, setMessage] = useState('로그인 후 입금확인 요청을 남기면 관리자 수동 입금 확인 후 승인합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  const selectedPlanAmountUsd = selectedPlan ? discountedAmount(selectedPlan) : 0;
  const selectedPlanAmountKrw = naverExchangeRate
    ? Math.round(selectedPlanAmountUsd * naverExchangeRate)
    : null;

  useEffect(() => {
    let isMounted = true;

    async function loadNaverExchangeRate() {
      try {
        const response = await fetch('/api/exchange-rate/usd-krw');
        const payload = await response.json() as ExchangeRateResult;
        if (!isMounted) return;
        if (!response.ok || !payload.rate) {
          setExchangeRateMessage(payload.message || '네이버 환율을 불러오지 못했습니다.');
          return;
        }
        setNaverExchangeRate(payload.rate);
        setExchangeRateMessage(`네이버 환율 ${payload.rate.toLocaleString('ko-KR')}원 적용`);
      } catch {
        if (isMounted) setExchangeRateMessage('네이버 환율을 불러오지 못했습니다.');
      }
    }

    void loadNaverExchangeRate();
    return () => {
      isMounted = false;
    };
  }, []);

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
        exchangeRate: paymentMethod === 'bank_transfer' ? naverExchangeRate : undefined,
        transactionId: paymentMethod === 'usdt' ? transactionId : undefined,
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
        <span className="form-section-label">결제 방식</span>
        <div className="payment-method-tabs" role="tablist" aria-label="결제 방식 선택">
          <button
            aria-pressed={paymentMethod === 'bank_transfer'}
            className={`payment-method-tab${paymentMethod === 'bank_transfer' ? ' active' : ''}`}
            onClick={() => setPaymentMethod('bank_transfer')}
            type="button"
          >
            은행이체
          </button>
          <button
            aria-pressed={paymentMethod === 'usdt'}
            className={`payment-method-tab${paymentMethod === 'usdt' ? ' active' : ''}`}
            onClick={() => setPaymentMethod('usdt')}
            type="button"
          >
            가상화폐
          </button>
        </div>
        <div className="payment-transfer-info">
          {paymentMethod === 'bank_transfer' ? (
            <>
              <strong>은행 입금 정보</strong>
              <strong className="krw-payment-amount">
                결제금액: {selectedPlanAmountKrw ? `${selectedPlanAmountKrw.toLocaleString('ko-KR')}원` : '환율 확인 중'}
              </strong>
              <span>{exchangeRateMessage}</span>
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
        {paymentMethod === 'usdt' ? (
          <>
            <label htmlFor="transactionId">USDT TXID</label>
            <input
              id="transactionId"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              placeholder="테더 이체 후 TXID를 입력하세요"
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="depositorName">입금자명</label>
            <input
              id="depositorName"
              value={depositorName}
              onChange={(event) => setDepositorName(event.target.value)}
              placeholder="입금자명을 입력하세요"
            />
          </>
        )}
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
