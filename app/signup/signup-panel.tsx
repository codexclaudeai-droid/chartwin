'use client';

import { useEffect, useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';

type WebInfoSettings = {
  termsContent: string;
  privacyContent: string;
};

const defaultWebInfoSettings: WebInfoSettings = {
  termsContent: '가입약관을 불러오는 중입니다.',
  privacyContent: '개인정보보호정책을 불러오는 중입니다.',
};

export function SignupPanel() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [webInfoSettings, setWebInfoSettings] = useState<WebInfoSettings>(defaultWebInfoSettings);
  const [message, setMessage] = useState('비밀번호는 8자 이상, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const referralCodeFromUrl = searchParams.get('ref')?.trim() ?? '';
    if (referralCodeFromUrl) setReferralCode(referralCodeFromUrl);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadWebInfo() {
      const response = await fetch('/api/web-info');
      const payload = await response.json();
      if (!isMounted || !response.ok) return;
      setWebInfoSettings(payload.settings);
    }

    void loadWebInfo();
    return () => {
      isMounted = false;
    };
  }, []);

  async function signup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      setMessage('가입약관과 개인정보보호정책에 모두 동의해야 회원가입이 가능합니다.');
      return;
    }

    setIsSubmitting(true);
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name,
        phoneNumber,
        password,
        passwordConfirm,
        referralCode,
        acceptedTerms,
        acceptedPrivacy,
      }),
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
        <label htmlFor="signupPhoneNumber">연락번호</label>
        <input
          id="signupPhoneNumber"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="010-0000-0000"
          required
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
        <label htmlFor="signupPasswordConfirm">비밀번호 확인</label>
        <input
          id="signupPasswordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          placeholder="비밀번호 재입력"
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

        <div className="signup-policy-box">
          <details id="signupTermsAgreement">
            <summary>가입약관 내용 확인</summary>
            <pre>{webInfoSettings.termsContent}</pre>
          </details>
          <label className="checkbox-row" htmlFor="signupAcceptedTerms">
            <input
              checked={acceptedTerms}
              id="signupAcceptedTerms"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              type="checkbox"
              required
            />
            가입약관에 동의합니다.
          </label>

          <details id="signupPrivacyAgreement">
            <summary>개인정보보호정책 내용 확인</summary>
            <pre>{webInfoSettings.privacyContent}</pre>
          </details>
          <label className="checkbox-row" htmlFor="signupAcceptedPrivacy">
            <input
              checked={acceptedPrivacy}
              id="signupAcceptedPrivacy"
              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              type="checkbox"
              required
            />
            개인정보보호정책에 동의합니다.
          </label>
        </div>

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '가입 중' : '회원가입'}
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}
