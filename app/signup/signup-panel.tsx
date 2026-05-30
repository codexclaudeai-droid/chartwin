'use client';

import { useEffect, useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';
import { getSafeRedirectPath } from '../auth-redirect';
import { formatSignupPhoneNumber } from './phone-format';

type WebInfoSettings = {
  termsContent: string;
  privacyContent: string;
};

type ReferrerPreview = {
  name: string;
  emailMasked: string;
  message: string;
  ok: boolean;
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
  const [lockedReferralCode, setLockedReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [webInfoSettings, setWebInfoSettings] = useState<WebInfoSettings>(defaultWebInfoSettings);
  const [message, setMessage] = useState('회원가입 정보를 입력하고 약관에 동의해 주세요.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [referrerPreview, setReferrerPreview] = useState<ReferrerPreview | null>(null);
  const [emailCheck, setEmailCheck] = useState<{
    email: string;
    available: boolean;
    message: string;
  } | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const isEmailConfirmed = Boolean(emailCheck?.available && emailCheck.email === normalizedEmail);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const referralCodeFromUrl = searchParams.get('ref')?.trim() ?? '';
    if (referralCodeFromUrl) {
      setReferralCode(referralCodeFromUrl);
      setLockedReferralCode(referralCodeFromUrl);
      void checkReferralPreview(referralCodeFromUrl);
    }
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
    if (!isEmailConfirmed) {
      setMessage('이메일 중복 확인을 먼저 완료해 주세요.');
      return;
    }
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
    if (response.ok) {
      dispatchAuthSessionChangedEvent();
      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = getSafeRedirectPath(searchParams) ?? '/';
      setMessage(`${payload.user.email} 회원가입이 정상 완료되었습니다. 잠시 후 이동합니다.`);
      window.setTimeout(() => {
        window.location.assign(nextPath);
      }, 800);
      return;
    }
    setMessage(payload.message || '회원가입에 실패했습니다.');
  }

  function handlePhoneNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPhoneNumber(formatSignupPhoneNumber(event.target.value));
  }

  function handleEmailChange(event: React.ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    setEmailCheck(null);
  }

  function handleReferralCodeChange(event: React.ChangeEvent<HTMLInputElement>) {
    setReferralCode(event.target.value);
    setReferrerPreview(null);
  }

  async function checkEmailAvailability() {
    if (!normalizedEmail.includes('@')) {
      setEmailCheck({
        email: normalizedEmail,
        available: false,
        message: '올바른 이메일을 입력해 주세요.',
      });
      return;
    }

    setIsCheckingEmail(true);
    const response = await fetch(`/api/auth/email-check?email=${encodeURIComponent(normalizedEmail)}`);
    const payload = await response.json();
    setIsCheckingEmail(false);
    setEmailCheck({
      email: normalizedEmail,
      available: Boolean(response.ok && payload.available),
      message: payload.message || '이메일 확인에 실패했습니다.',
    });
  }

  async function checkReferralPreview(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode) return;

    setIsCheckingReferral(true);
    try {
      const response = await fetch(`/api/auth/referral-check?code=${encodeURIComponent(normalizedCode)}`);
      const payload = await response.json();
      setReferrerPreview({
        name: payload.referrer?.name ?? '',
        emailMasked: payload.referrer?.emailMasked ?? '',
        message: payload.message || '추천코드 확인에 실패했습니다.',
        ok: Boolean(response.ok && payload.found),
      });
    } catch {
      setReferrerPreview({
        name: '',
        emailMasked: '',
        message: '추천코드 확인에 실패했습니다.',
        ok: false,
      });
    } finally {
      setIsCheckingReferral(false);
    }
  }

  return (
    <section className="card signup-form-card auth-card">
      <form className="form" onSubmit={signup}>
        <label htmlFor="signupEmail"><span className="required-mark" aria-hidden="true">*</span>이메일</label>
        <div className="email-check-row">
          <input
            id="signupEmail"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@example.com"
            required
          />
          <button className="button secondary" type="button" onClick={checkEmailAvailability} disabled={isCheckingEmail}>
            {isCheckingEmail ? '확인 중' : '중복확인'}
          </button>
        </div>
        {emailCheck && (
          <p className={`field-help ${emailCheck.available ? 'success' : 'error'}`}>
            {emailCheck.message}
          </p>
        )}

        <label htmlFor="signupName"><span className="required-mark" aria-hidden="true">*</span>이름</label>
        <input
          id="signupName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="표시 이름"
          required
        />

        <label htmlFor="signupPhoneNumber"><span className="required-mark" aria-hidden="true">*</span>연락번호</label>
        <input
          id="signupPhoneNumber"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          placeholder="010-0000-0000"
          inputMode="numeric"
          maxLength={13}
          required
        />

        <label htmlFor="signupPassword"><span className="required-mark" aria-hidden="true">*</span>비밀번호</label>
        <input
          id="signupPassword"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자리 이상, 대문자, 숫자, 특수문자 포함"
          required
        />

        <label htmlFor="signupPasswordConfirm"><span className="required-mark" aria-hidden="true">*</span>비밀번호 확인</label>
        <input
          id="signupPasswordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          placeholder="비밀번호 재입력"
          required
        />

        <label htmlFor="signupReferralCode">추천코드 (선택)</label>
        <div className="referral-code-row">
          <input
            id="signupReferralCode"
            value={referralCode}
            onChange={handleReferralCodeChange}
            readOnly={Boolean(lockedReferralCode)}
            placeholder="선택사항: 추천코드가 있으면 입력"
          />
          {!lockedReferralCode && (
            <button
              className="button secondary"
              disabled={isCheckingReferral || !referralCode.trim()}
              onClick={() => void checkReferralPreview(referralCode)}
              type="button"
            >
              {isCheckingReferral ? '확인 중' : '추천인 확인'}
            </button>
          )}
        </div>
        {referralCode && (
          <div className="notice signup-referral-note">
            {isCheckingReferral ? (
              <small className="signup-referrer-preview">추천인을 확인하는 중입니다.</small>
            ) : referrerPreview?.ok ? (
              <small className="signup-referrer-preview success">
                추천인: {referrerPreview.name} ({referrerPreview.emailMasked})
              </small>
            ) : referrerPreview ? (
              <small className="signup-referrer-preview error">{referrerPreview.message}</small>
            ) : (
              <small className="signup-referrer-preview">추천인 확인을 누르면 추천인 정보를 확인할 수 있습니다.</small>
            )}
          </div>
        )}

        <div className="signup-policy-box">
          <div className="signup-policy-row">
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
              동의합니다.
            </label>
          </div>

          <div className="signup-policy-row">
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
              동의합니다.
            </label>
          </div>
        </div>

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '가입 중' : '회원가입'}
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}
