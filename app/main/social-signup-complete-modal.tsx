'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SocialSignupCompleteModalProps = {
  show: boolean;
  isExistingAccount?: boolean;
};

export function SocialSignupCompleteModal({
  show,
  isExistingAccount = false,
}: SocialSignupCompleteModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(show);

  if (!isOpen) return null;

  function closeModal() {
    setIsOpen(false);
    router.replace('/main', { scroll: false });
  }

  return (
    <div
      className="pricing-auth-modal-backdrop signup-complete-modal-backdrop"
      role="presentation"
      onClick={closeModal}
    >
      <div
        aria-labelledby="social-signup-complete-modal-title"
        aria-modal="true"
        className="pricing-auth-modal signup-complete-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="social-signup-complete-modal-title">
          {isExistingAccount ? '이미 가입된 계정입니다' : '회원가입이 완료되었습니다'}
        </h3>
        <p>
          {isExistingAccount ? '로그인되었습니다.' : 'TradingCore에 오신 것을 환영합니다.'}
        </p>
        <p>
          {isExistingAccount ? '기존 계정으로 서비스를 계속 이용할 수 있습니다.' : '바로 로그인할 수 있습니다.'}
        </p>
        <div className="pricing-auth-modal-actions single">
          <button className="button" type="button" onClick={closeModal}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
