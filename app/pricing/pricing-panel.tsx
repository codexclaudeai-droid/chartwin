'use client';

import { useState } from 'react';

type Plan = {
  id: string;
  name: string;
  durationDays: number;
  basePriceUsd: number;
  discountPercent: number;
};

type PaymentResult = {
  payment?: {
    id: string;
    status: string;
    amountUsd: number;
  };
  message?: string;
};

export function PricingPanel({ plans }: { plans: Plan[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? 'plan_monthly');
  const [depositorName, setDepositorName] = useState('');
  const [message, setMessage] = useState('로그인 후 결제 요청을 남기면 관리자가 입금 확인 뒤 승인합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/payments/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlanId,
        method: 'bank_transfer',
        depositorName,
      }),
    });
    const payload = await response.json() as PaymentResult;
    setIsSubmitting(false);
    setMessage(response.ok && payload.payment
      ? `결제 요청 ${payload.payment.id}이 접수되었습니다. 상태: ${payload.payment.status}`
      : payload.message || '결제 요청에 실패했습니다. 먼저 로그인해 주세요.');
  }

  return (
    <section className="card">
      <form className="form" onSubmit={requestPayment}>
        <label htmlFor="planId">구독 플랜</label>
        <select id="planId" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} / {plan.durationDays}일 / ${discountedAmount(plan)}
            </option>
          ))}
        </select>
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
