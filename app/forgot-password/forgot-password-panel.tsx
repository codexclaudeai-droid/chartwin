'use client';

import { useState } from 'react';

export function ForgotPasswordPanel() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('가입 이메일을 입력하면 비밀번호 재설정 안내를 발송합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setIsSubmitting(false);
    if (payload.resetTokenPreview) {
      setToken(payload.resetTokenPreview);
      setMessage('비밀번호 재설정 요청이 접수되었습니다. 안내에 따라 재설정 코드를 확인해 주세요.');
      return;
    }
    setMessage(payload.message ?? '비밀번호 재설정 요청이 접수되었습니다.');
  }

  async function confirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const payload = await response.json();
    setIsSubmitting(false);
    setMessage(response.ok ? '비밀번호가 변경되었습니다. 새 비밀번호로 로그인할 수 있습니다.' : payload.message);
  }

  return (
    <section className="card auth-card">
      <form className="form" onSubmit={requestReset}>
        <label htmlFor="resetEmail">가입 이메일</label>
        <input
          id="resetEmail"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <button className="button" type="submit" disabled={isSubmitting}>
          재설정 안내 받기
        </button>
      </form>

      <form className="form" onSubmit={confirmReset}>
        <label htmlFor="resetToken">재설정 코드</label>
        <input
          id="resetToken"
          name="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <label htmlFor="newPassword">새 비밀번호</label>
        <input
          id="newPassword"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자리 이상, 대문자, 숫자, 특수문자 포함"
          autoComplete="new-password"
        />
        <button className="button secondary" type="submit" disabled={isSubmitting}>
          비밀번호 재설정
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}
