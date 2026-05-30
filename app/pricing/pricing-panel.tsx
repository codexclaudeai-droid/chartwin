'use client';

import { useEffect, useRef, useState } from 'react';
import { dispatchNotificationsRefreshEvent } from '../notification-events';
import { AuthPromptModal } from '../shared/auth-prompt-modal';
import { resolveInitialPricingPlanId } from './plan-selection.ts';

type CheckoutStep = 'plan' | 'payment' | 'confirm' | 'submitted';

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

function formatPricingLandingPlanName(plan: Plan): string {
  if (plan.id === 'plan_monthly') return 'BASIC';
  if (plan.id === 'plan_half_year') return 'PRO';
  if (plan.id === 'plan_yearly') return 'ELITE';
  return plan.name;
}

function formatPricingLandingPlanPeriod(plan: Plan): string {
  if (plan.id === 'plan_monthly') return '/1개월';
  if (plan.id === 'plan_half_year') return '/ 6개월';
  if (plan.id === 'plan_yearly') return '/ 1년';
  return `/ ${plan.durationDays}일`;
}

function formatPricingLandingPlanDiscount(plan: Plan): string | null {
  if (plan.discountPercent <= 0) return null;
  return `${plan.discountPercent}% 할인`;
}

function formatPricingLandingPlanNote(plan: Plan): string {
  if (plan.id === 'plan_monthly') return '가볍게 시작하고 나만의 매매 타이밍을 시험해보고 싶은 분들을 위한 기본 요금제';
  if (plan.id === 'plan_half_year') return '일관된 매매 원칙을 다지고 체계적인 중단기 전략을 선호하는 액티브 트레이더 추천 요금제';
  if (plan.id === 'plan_yearly') return '최적의 속도와 맞춤형 지원을 통해 최상의 결과를 추구하는 프로/기업 사용자용 패키지';
  return `${plan.durationDays}일 이용 · ${plan.discountPercent}% 할인`;
}

function formatPricingLandingPlanIconType(plan: Plan): 'basic' | 'pro' | 'elite' {
  if (plan.id === 'plan_half_year') return 'pro';
  if (plan.id === 'plan_yearly') return 'elite';
  return 'basic';
}

function renderPricingLandingPlanIcon(plan: Plan) {
  const iconType = formatPricingLandingPlanIconType(plan);

  return (
    <span className={`landing-plan-icon ${iconType}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {iconType === 'basic' ? (
          <>
            <circle cx="12" cy="12" r="7" />
            <path d="M9 15l3-8 3 8-3-2z" />
          </>
        ) : null}
        {iconType === 'pro' ? (
          <>
            <path d="M5 15h4l2-7 3 10 2-6h3" />
            <path d="M6 8h4" />
          </>
        ) : null}
        {iconType === 'elite' ? (
          <>
            <path d="M12 4l7 7-7 9-7-9z" />
            <path d="M5 11h14M9 4l3 16 3-16" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

const CHECKOUT_STEPS: Array<{ key: CheckoutStep; label: string; description: string }> = [
  { key: 'plan', label: '플랜 선택', description: '이용 기간과 가격을 선택합니다.' },
  { key: 'payment', label: '결제방식 및 금액 확인', description: '은행이체 또는 USDT 정보를 확인합니다.' },
  { key: 'confirm', label: '구독확정', description: '신청 내용을 최종 확인합니다.' },
  { key: 'submitted', label: '입금확인 요청 완료', description: '입금확인 및 승인 대기합니다.' },
];

export function PricingPanel({
  initialPlanId,
  plans,
  paymentSettings,
  planServices,
}: {
  initialPlanId?: string | null;
  plans: Plan[];
  paymentSettings: PaymentTransferSettings;
  planServices: Record<string, string[]>;
}) {
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('plan');
  const [selectedPlanId, setSelectedPlanId] = useState(() => (
    resolveInitialPricingPlanId(plans, initialPlanId)
  ));
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'usdt'>('bank_transfer');
  const [depositorName, setDepositorName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submittedPaymentId, setSubmittedPaymentId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const [naverExchangeRate, setNaverExchangeRate] = useState<number | null>(null);
  const [exchangeRateMessage, setExchangeRateMessage] = useState('네이버 환율을 불러오는 중입니다.');
  const [message, setMessage] = useState('로그인 후 단계별로 구독을 확정하면 관리자 수동 입금 확인 후 승인됩니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const depositorNameInputRef = useRef<HTMLInputElement>(null);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  const selectedPlanAmountUsd = selectedPlan ? discountedAmount(selectedPlan) : 0;
  const selectedPlanAmountKrw = naverExchangeRate
    ? Math.round(selectedPlanAmountUsd * naverExchangeRate)
    : null;

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
  }

  function handlePlanCardKeyDown(event: React.KeyboardEvent<HTMLElement>, planId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectPlan(planId);
  }

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

  useEffect(() => {
    let isMounted = true;

    async function loadAuthState() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!isMounted) return;
        if (!response.ok) {
          setIsAuthenticated(false);
          return;
        }

        const payload = await response.json() as { authenticated?: boolean };
        if (!isMounted) return;
        setIsAuthenticated(Boolean(payload.authenticated));
      } catch {
        if (isMounted) setIsAuthenticated(false);
      }
    }

    void loadAuthState();
    return () => {
      isMounted = false;
    };
  }, []);

  function promptAuth() {
    setShowAuthPromptModal(true);
    setMessage('플랜 신청은 로그인 후 진행할 수 있습니다.');
  }

  function moveToPaymentStep() {
    if (!isAuthenticated) {
      promptAuth();
      return;
    }
    if (!selectedPlan) {
      setMessage('먼저 구독 플랜을 선택하세요.');
      return;
    }
    setMessage('결제방식과 결제금액을 확인해 주세요.');
    setCheckoutStep('payment');
  }

  function moveToConfirmStep() {
    if (!isAuthenticated) {
      promptAuth();
      return;
    }
    if (!validateBankTransferDepositorName()) return;
    if (paymentMethod === 'usdt' && !transactionId.trim()) {
      setMessage('USDT 이체 후 TXID를 입력해야 다음 단계로 이동할 수 있습니다.');
      return;
    }
    setMessage('구독확정 전 플랜, 결제방식, 결제금액을 최종 확인해 주세요.');
    setCheckoutStep('confirm');
  }

  async function requestPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated) {
      promptAuth();
      return;
    }
    if (checkoutStep !== 'confirm') {
      moveToConfirmStep();
      return;
    }
    if (!validateBankTransferDepositorName()) return;

    setIsSubmitting(true);
    const response = await fetch('/api/payments/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlanId,
        method: paymentMethod,
        depositorName: paymentMethod === 'bank_transfer' ? depositorName.trim() : depositorName,
        exchangeRate: paymentMethod === 'bank_transfer' ? naverExchangeRate : undefined,
        transactionId: paymentMethod === 'usdt' ? transactionId : undefined,
      }),
    });
    const payload = await response.json() as PaymentResult;
    setIsSubmitting(false);
    if (response.ok && payload.payment) {
      dispatchNotificationsRefreshEvent();
      setSubmittedPaymentId(payload.payment.id);
      setCheckoutStep('submitted');
      setMessage(`입금확인 요청이 접수되었습니다. 관리자 수동 입금 확인 전까지 상태: ${payload.payment.status}`);
      return;
    }
    setMessage(payload.message || '결제 요청에 실패했습니다. 먼저 로그인해 주세요.');
  }

  function validateBankTransferDepositorName(): boolean {
    if (paymentMethod !== 'bank_transfer' || depositorName.trim()) return true;

    const alertMessage = '은행이체는 입금자명을 입력해야 다음 단계로 진행할 수 있습니다.';
    window.alert(alertMessage);
    setMessage(alertMessage);
    depositorNameInputRef.current?.focus();
    return false;
  }

  return (
    <section className="card pricing-checkout-card">
      <ol className="checkout-stepper" aria-label="구독 신청 단계">
        {CHECKOUT_STEPS.map((step, index) => (
          <li
            className={`checkout-step ${getStepStateClass(step.key, checkoutStep)}`}
            key={step.key}
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.description}</small>
          </li>
        ))}
      </ol>

      <form className="form" onSubmit={requestPayment}>
        {checkoutStep === 'plan' && (
          <div className="checkout-step-panel">
            <span className="form-section-label">플랜 선택</span>
            <div className="landing-plan-grid pricing-plan-selection-grid" role="radiogroup" aria-label="구독 플랜 선택">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const isRecommended = isRecommendedPlan(plan);
                return (
                  <article
                    aria-checked={isSelected}
                    className={`landing-plan-card pricing-plan-card${isRecommended ? ' featured' : ''}${isSelected ? ' selected' : ''}`}
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    onKeyDown={(event) => handlePlanCardKeyDown(event, plan.id)}
                    role="radio"
                    tabIndex={0}
                  >
                    <input
                      aria-hidden="true"
                      type="radio"
                      name="planId"
                      value={plan.id}
                      checked={selectedPlanId === plan.id}
                      onChange={() => setSelectedPlanId(plan.id)}
                      tabIndex={-1}
                    />
                    <div className="landing-plan-card-header">
                      <h3 className="landing-plan-title">
                        {renderPricingLandingPlanIcon(plan)}
                        <span>{formatPricingLandingPlanName(plan)}</span>
                      </h3>
                      {isRecommended ? <span className="landing-plan-badge">★ RECOMMENDED</span> : null}
                    </div>
                    <div className="landing-plan-price-row">
                      <strong>${discountedAmount(plan)}</strong>
                      <span className="landing-plan-period">{formatPricingLandingPlanPeriod(plan)}</span>
                    </div>
                    {formatPricingLandingPlanDiscount(plan) ? (
                      <span className="landing-plan-discount">{formatPricingLandingPlanDiscount(plan)}</span>
                    ) : null}
                    <p>{formatPricingLandingPlanNote(plan)}</p>
                    <ul className="landing-plan-feature-list" aria-label={`${formatPricingLandingPlanName(plan)} 제공 서비스`}>
                      {(planServices[plan.id] ?? getCheckoutPlanServices(plan)).map((service) => (
                        <li key={service}>{service}</li>
                      ))}
                    </ul>
                    <small>{plan.durationDays}일 이용권 · 정가 ${plan.basePriceUsd.toLocaleString('en-US')}</small>
                    <div className="landing-plan-card-footer">
                      <span>{isRecommended ? 'Best value for active traders' : 'Flexible trading access'}</span>
                      <button
                        className={`${isRecommended ? 'button' : 'button secondary'}${isSelected ? ' selected' : ''}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectPlan(plan.id);
                        }}
                      >
                        {isSelected ? '선택됨' : '플랜 선택하기'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="checkout-actions">
              <button className="button" type="button" onClick={moveToPaymentStep}>
                다음
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'payment' && (
          <div className="checkout-step-panel">
            <span className="form-section-label">결제방식 및 결제금액 확인</span>
            <PaymentMethodTabs
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
            />
            <PaymentTransferInfo
              exchangeRateMessage={exchangeRateMessage}
              paymentMethod={paymentMethod}
              paymentSettings={paymentSettings}
              selectedPlanAmountUsd={selectedPlanAmountUsd}
              selectedPlanAmountKrw={selectedPlanAmountKrw}
            />
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
                  ref={depositorNameInputRef}
                  value={depositorName}
                  onChange={(event) => setDepositorName(event.target.value)}
                  placeholder="입금자명을 입력하세요"
                  required
                />
              </>
            )}
            <div className="checkout-actions">
              <button className="button secondary" type="button" onClick={() => setCheckoutStep('plan')}>
                이전
              </button>
              <button className="button" type="button" onClick={moveToConfirmStep}>
                다음
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'confirm' && (
          <div className="checkout-step-panel">
            <span className="form-section-label">구독확정</span>
            <div className="checkout-confirm-grid">
              <SummaryItem label="선택 플랜" value={selectedPlan ? formatCheckoutPlanName(selectedPlan) : '미선택'} />
              <SummaryItem label="이용 기간" value={selectedPlan ? `${selectedPlan.durationDays}일` : '-'} />
              <SummaryItem label="결제 방식" value={paymentMethod === 'bank_transfer' ? '은행이체' : '가상화폐 USDT'} />
              <SummaryItem label="결제금액 USD" value={`$${selectedPlanAmountUsd}`} />
              <SummaryItem
                label="결제금액 원화"
                value={selectedPlanAmountKrw ? `${selectedPlanAmountKrw.toLocaleString('ko-KR')}원` : '환율 확인 중'}
              />
              <SummaryItem label={paymentMethod === 'bank_transfer' ? '입금자명' : 'TXID'} value={paymentMethod === 'bank_transfer' ? depositorName || '미입력' : transactionId} />
            </div>
            <PaymentTransferInfo
              exchangeRateMessage={exchangeRateMessage}
              paymentMethod={paymentMethod}
              paymentSettings={paymentSettings}
              selectedPlanAmountUsd={selectedPlanAmountUsd}
              selectedPlanAmountKrw={selectedPlanAmountKrw}
            />
            <div className="checkout-actions">
              <button className="button secondary" type="button" onClick={() => setCheckoutStep('payment')}>
                이전
              </button>
              <button className="button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '요청 중' : '구독확정 및 입금확인 요청'}
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'submitted' && (
          <div className="checkout-step-panel checkout-complete-panel">
            <span className="form-section-label">입금확인 요청 완료</span>
            <h2>구독 신청이 접수되었습니다.</h2>
            <p>
              요청번호 {submittedPaymentId || '확인 중'} 기준으로 관리자가 실제 입금 내역을 수동 확인한 뒤 구독승인을 진행합니다.
            </p>
            <div className="checkout-actions">
              <a className="button" href="/profile">
                마이프로필에서 상태 확인
              </a>
              <button className="button secondary" type="button" onClick={() => setCheckoutStep('plan')}>
                다른 플랜 신청
              </button>
            </div>
          </div>
        )}
      </form>
      <p className="notice">{message}</p>
      {showAuthPromptModal ? (
        <AuthPromptModal
          title="로그인 후 플랜 신청이 가능합니다."
          description="회원가입 또는 로그인 후 구독 신청을 진행해 주세요."
          loginHref="/login?redirect=/pricing"
          signupHref="/signup?redirect=/pricing"
          onClose={() => setShowAuthPromptModal(false)}
        />
      ) : null}
    </section>
  );
}

function PaymentMethodTabs({
  paymentMethod,
  setPaymentMethod,
}: {
  paymentMethod: 'bank_transfer' | 'usdt';
  setPaymentMethod: (method: 'bank_transfer' | 'usdt') => void;
}) {
  return (
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
  );
}

function PaymentTransferInfo({
  exchangeRateMessage,
  paymentMethod,
  paymentSettings,
  selectedPlanAmountUsd,
  selectedPlanAmountKrw,
}: {
  exchangeRateMessage: string;
  paymentMethod: 'bank_transfer' | 'usdt';
  paymentSettings: PaymentTransferSettings;
  selectedPlanAmountUsd: number;
  selectedPlanAmountKrw: number | null;
}) {
  return (
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
          <strong className="usdt-payment-amount">
            USDT 전송 수량: {formatUsdtTransferQuantity(selectedPlanAmountUsd)} USDT
          </strong>
          <span>테더주소: {paymentSettings.usdtAddress}</span>
          <span>네트워크: {paymentSettings.usdtNetwork}</span>
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStepStateClass(step: CheckoutStep, currentStep: CheckoutStep): string {
  const currentIndex = CHECKOUT_STEPS.findIndex((item) => item.key === currentStep);
  const stepIndex = CHECKOUT_STEPS.findIndex((item) => item.key === step);
  if (step === currentStep) return 'current';
  if (stepIndex < currentIndex) return 'done';
  return 'waiting';
}

function discountedAmount(plan: Plan): number {
  return Math.round(plan.basePriceUsd * (1 - plan.discountPercent / 100) * 100) / 100;
}

function formatUsdtTransferQuantity(amountUsd: number): string {
  return amountUsd.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amountUsd) ? 0 : 2,
  });
}

function isRecommendedPlan(plan: Plan): boolean {
  return plan.id === 'plan_half_year';
}

function formatCheckoutPlanName(plan: Plan): string {
  if (plan.id === 'plan_monthly') return 'BASIC';
  if (plan.id === 'plan_half_year') return 'PRO';
  if (plan.id === 'plan_yearly') return 'ELITE';
  return plan.name;
}

function getCheckoutPlanServices(plan: Plan): string[] {
  const commonServices = [
    'TC Chart 접근',
    '유료 시그널 열람',
    '마이프로필 구독 상태 확인',
  ];
  if (plan.id === 'plan_monthly') {
    return [...commonServices, '30일 단위로 부담 없이 이용'];
  }
  if (plan.id === 'plan_half_year') {
    return [...commonServices, '6개월 추천 플랜 할인 적용', '입금확인 요청 우선 검토'];
  }
  if (plan.id === 'plan_yearly') {
    return [...commonServices, '12개월 장기 할인 적용', '장기 이용자 운영 안내'];
  }
  return commonServices;
}
