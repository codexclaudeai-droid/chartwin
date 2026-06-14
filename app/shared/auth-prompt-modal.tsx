'use client';

import { createPortal } from 'react-dom';

type AuthPromptModalProps = {
  title: string;
  description: string;
  loginHref: string;
  signupHref: string;
  onClose: () => void;
};

export function AuthPromptModal({
  title,
  description,
  loginHref,
  signupHref,
  onClose,
}: AuthPromptModalProps) {
  const modal = (
    <div className="pricing-auth-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        aria-labelledby="pricing-auth-modal-title"
        aria-modal="true"
        className="pricing-auth-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="pricing-auth-modal-title">{title}</h3>
        <p>{description}</p>
        <div className="pricing-auth-modal-actions">
          <a className="button secondary" href={loginHref}>
            로그인
          </a>
          <a className="button" href={signupHref}>
            회원가입
          </a>
        </div>
        <button className="button subtle pricing-auth-modal-close" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
