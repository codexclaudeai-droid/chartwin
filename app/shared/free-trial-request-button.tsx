'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { AuthPromptModal } from './auth-prompt-modal';

type FreeTrialRequestButtonProps = {
  className?: string;
  children?: ReactNode;
  loginHref?: string;
  signupHref?: string;
  returnHref?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmActionLabel?: string;
  confirmCancelLabel?: string;
};

type TrialRequestPayload = {
  ok?: boolean;
  status?: 'started' | 'already_active';
  endsAt?: string | null;
  message?: string;
};

type ResultModalState = {
  title: string;
  description: string;
};

export function FreeTrialRequestButton({
  className = 'button secondary',
  children = '무료체험 신청',
  loginHref = '/login?redirect=/',
  signupHref = '/signup?redirect=/',
  returnHref = '/',
  confirmTitle,
  confirmDescription,
  confirmActionLabel = '진행하기',
  confirmCancelLabel = '취소',
}: FreeTrialRequestButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null);

  function handleClick() {
    if (confirmTitle && confirmDescription) {
      setShowConfirmPrompt(true);
      return;
    }

    void requestTrial();
  }

  function confirmAndRequestTrial() {
    setShowConfirmPrompt(false);
    void requestTrial();
  }

  async function requestTrial() {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/trial/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'landing' }),
      });
      const payload = await response.json().catch(() => ({})) as TrialRequestPayload;

      if (response.status === 401) {
        setShowAuthPrompt(true);
        return;
      }

      if (!response.ok || payload.ok !== true) {
        setResultModal({
          title: '무료체험 신청 확인 필요',
          description: payload.message || '무료체험 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      const endDateText = payload.endsAt ? formatKoreanDateTime(payload.endsAt) : null;
      setResultModal({
        title: payload.status === 'already_active' ? '무료체험 이용 중입니다' : '무료체험 신청이 접수되었습니다',
        description: endDateText
          ? `TC Chart 무료체험이 활성화되었습니다. 종료 예정일은 ${endDateText}입니다.`
          : 'TC Chart 이용 권한이 이미 활성화되어 있습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToLanding() {
    window.location.assign(returnHref);
  }

  return (
    <>
      <button className={className} type="button" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? '처리 중' : children}
      </button>
      {showConfirmPrompt ? (
        <div className="pricing-auth-modal-backdrop" role="presentation" onClick={() => setShowConfirmPrompt(false)}>
          <div
            aria-labelledby="free-trial-confirm-title"
            aria-modal="true"
            className="pricing-auth-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="free-trial-confirm-title">{confirmTitle}</h3>
            <p>{confirmDescription}</p>
            <div className="pricing-auth-modal-actions">
              <button className="button secondary" type="button" onClick={() => setShowConfirmPrompt(false)}>
                {confirmCancelLabel}
              </button>
              <button className="button" type="button" onClick={confirmAndRequestTrial}>
                {confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showAuthPrompt ? (
        <AuthPromptModal
          title="무료체험 신청은 로그인이 필요합니다"
          description="로그인 또는 회원가입 후 무료체험을 바로 신청할 수 있습니다."
          loginHref={loginHref}
          signupHref={signupHref}
          onClose={() => setShowAuthPrompt(false)}
        />
      ) : null}
      {resultModal ? (
        <div className="pricing-auth-modal-backdrop" role="presentation" onClick={returnToLanding}>
          <div
            aria-labelledby="free-trial-result-title"
            aria-modal="true"
            className="pricing-auth-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="free-trial-result-title">{resultModal.title}</h3>
            <p>{resultModal.description}</p>
            <div className="pricing-auth-modal-actions single">
              <button className="button" type="button" onClick={returnToLanding}>
                확인
              </button>
            </div>
            <button className="button subtle pricing-auth-modal-close" type="button" onClick={returnToLanding}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatKoreanDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date);
}
