'use client';

import { useState } from 'react';

export function VerifyEmailResendForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('인증 메일이 만료되었거나 보이지 않으면 이메일을 입력해 다시 받을 수 있습니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resendVerificationEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/auth/verify-email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);
    const emailDelivery = payload.emailDelivery;
    if (
      response.ok &&
      emailDelivery &&
      Number(emailDelivery.sent ?? 0) <= 0 &&
      Number(emailDelivery.failed ?? 0) > 0
    ) {
      const lastError = typeof emailDelivery.lastError === 'string' && emailDelivery.lastError
        ? ` 오류: ${emailDelivery.lastError.slice(0, 180)}`
        : '';
      setMessage(`인증 메일 재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.${lastError}`);
      return;
    }
    setMessage(payload.message || (response.ok
      ? '인증 메일 재발송 요청을 접수했습니다. 메일함을 확인해 주세요.'
      : '인증 메일 재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
  }

  return (
    <form className="form" onSubmit={resendVerificationEmail}>
      <label htmlFor="verifyEmailResendEmail">이메일</label>
      <input
        id="verifyEmailResendEmail"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
      />
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '재발송 중' : '인증 메일 재발송'}
      </button>
      <p className="notice">{message}</p>
    </form>
  );
}
