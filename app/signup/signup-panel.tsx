'use client';

import { useEffect, useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';

export function SignupPanel() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [message, setMessage] = useState('비밀번호는 8자 이상, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const referralCodeFromUrl = searchParams.get('ref')?.trim() ?? '';
    if (referralCodeFromUrl) setReferralCode(referralCodeFromUrl);
  }, []);

  async function signup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password, referralCode }),
    });
    const payload = await response.json();
    setIsSubmitting(false);
    if (response.ok) dispatchAuthSessionChangedEvent();
    setMessage(response.ok
      ? `${payload.user.email} 계정이 생성되고 로그인되었습니다.`
      : payload.message || '회원가입에 실패했습니다.');
  }

  return (
    <section className="card">
      <form className="form" onSubmit={signup}>
        <label htmlFor="signupEmail">이메일</label>
        <input
          id="signupEmail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <label htmlFor="signupName">이름</label>
        <input
          id="signupName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="표시 이름"
        />
        <label htmlFor="signupPassword">비밀번호</label>
        <input
          id="signupPassword"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Aa1!aaaa"
          required
        />
        <label htmlFor="signupReferralCode">추천코드 (선택)</label>
        <input
          id="signupReferralCode"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          placeholder="선택사항: 추천코드가 있으면 입력"
        />
        {referralCode && (
          <p className="notice">추천코드 {referralCode}가 회원가입에 적용됩니다.</p>
        )}
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '가입 중' : '회원가입'}
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}
