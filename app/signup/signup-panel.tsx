'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
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

type SignupValidationResult =
  | { ok: true }
  | { ok: false; message: string; fieldId?: string };

const defaultWebInfoSettings: WebInfoSettings = {
  termsContent: '가입약관을 불러오는 중입니다.',
  privacyContent: '개인정보보호정책을 불러오는 중입니다.',
};

const passwordPolicyMessage = '비밀번호는 8자리 이상, 영문 대문자, 영문 소문자, 숫자, 특수문자를 포함해야 합니다.';

function isValidSignupEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function satisfiesPasswordPolicy(value: string): boolean {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function SignupPanel() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordConfirmVisible, setIsPasswordConfirmVisible] = useState(false);
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
    const validation = validateSignupForm();
    if (validation.ok === false) {
      setMessage(validation.message);
      if (validation.fieldId) {
        document.getElementById(validation.fieldId)?.focus();
      }
      return;
    }

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
      const verificationRequired = Boolean(payload.verificationRequired);
      setMessage(verificationRequired
        ? `${payload.user.email} 이메일 인증이 필요합니다. 발송된 인증 메일을 확인해 주세요.`
        : `${payload.user.email} 회원가입이 정상 완료되었습니다.`);
      return;
    }
    setMessage(payload.message || '회원가입에 실패했습니다.');
  }

  function announceSocialAuthPreparation(providerName: string) {
    setMessage(`${providerName} 간편가입은 서비스 준비중입니다.`);
  }

  function validateSignupForm(): SignupValidationResult {
    if (!normalizedEmail) {
      return { ok: false, message: '이메일을 입력해 주세요.', fieldId: 'signupEmail' };
    }
    if (!isValidSignupEmail(normalizedEmail)) {
      return { ok: false, message: '올바른 이메일을 입력해 주세요.', fieldId: 'signupEmail' };
    }
    if (!isEmailConfirmed) {
      return { ok: false, message: '이메일 중복확인을 먼저 완료해 주세요.', fieldId: 'signupEmail' };
    }
    if (!name.trim()) {
      return { ok: false, message: '이름을 입력해 주세요.', fieldId: 'signupName' };
    }
    if (!phoneNumber.trim()) {
      return { ok: false, message: '연락번호를 입력해 주세요.', fieldId: 'signupPhoneNumber' };
    }
    if (!password) {
      return { ok: false, message: '비밀번호를 입력해 주세요.', fieldId: 'signupPassword' };
    }
    if (!satisfiesPasswordPolicy(password)) {
      return { ok: false, message: passwordPolicyMessage, fieldId: 'signupPassword' };
    }
    if (!passwordConfirm) {
      return { ok: false, message: '비밀번호 확인을 입력해 주세요.', fieldId: 'signupPasswordConfirm' };
    }
    if (password !== passwordConfirm) {
      return { ok: false, message: '비밀번호 확인이 일치하지 않습니다.', fieldId: 'signupPasswordConfirm' };
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      return { ok: false, message: '가입약관과 개인정보보호정책에 모두 동의해야 회원가입이 가능합니다.' };
    }

    return { ok: true };
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
      <form className="form" onSubmit={signup} noValidate>
        <div className="signup-field-row">
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
        </div>
        {emailCheck && (
          <p className={`field-help ${emailCheck.available ? 'success' : 'error'}`}>
            {emailCheck.message}
          </p>
        )}

        <div className="signup-field-row">
          <label htmlFor="signupName"><span className="required-mark" aria-hidden="true">*</span>이름</label>
          <input
            id="signupName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="표시 이름"
            required
          />
        </div>

        <div className="signup-field-row">
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
        </div>

        <div className="signup-field-row">
          <label htmlFor="signupPassword"><span className="required-mark" aria-hidden="true">*</span>비밀번호</label>
          <div className="password-input-shell">
            <input
              id="signupPassword"
              type={isPasswordVisible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자리 이상, 대문자, 숫자, 특수문자 포함"
              required
            />
            <button
              aria-label={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
              aria-pressed={isPasswordVisible}
              className="password-visibility-toggle"
              onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
              type="button"
            >
              {isPasswordVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>

        <div className="signup-field-row">
          <label htmlFor="signupPasswordConfirm"><span className="required-mark" aria-hidden="true">*</span>비밀번호 확인</label>
          <div className="password-input-shell">
            <input
              id="signupPasswordConfirm"
              type={isPasswordConfirmVisible ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="비밀번호 재입력"
              required
            />
            <button
              aria-label={isPasswordConfirmVisible ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'}
              aria-pressed={isPasswordConfirmVisible}
              className="password-visibility-toggle"
              onClick={() => setIsPasswordConfirmVisible((isVisible) => !isVisible)}
              type="button"
            >
              {isPasswordConfirmVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>

        <div className="signup-field-row">
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
              {renderPolicyContent(webInfoSettings.termsContent)}
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
              {renderPolicyContent(webInfoSettings.privacyContent)}
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
        <div className="social-auth-divider" role="separator" aria-label="간편가입"></div>
        <div className="social-auth-actions signup-social-auth-actions" aria-label="간편가입">
          <button
            className="social-auth-button social-auth-button-google"
            onClick={() => announceSocialAuthPreparation('Google')}
            type="button"
          >
            <span className="social-auth-logo" aria-hidden="true">{renderGoogleLogo()}</span>
            <span>Google로 가입</span>
          </button>
          <button
            className="social-auth-button social-auth-button-naver"
            onClick={() => announceSocialAuthPreparation('네이버')}
            type="button"
          >
            <span className="social-auth-logo" aria-hidden="true">{renderNaverLogo()}</span>
            <span>네이버로 가입</span>
          </button>
          <button
            className="social-auth-button social-auth-button-kakao"
            onClick={() => announceSocialAuthPreparation('카카오')}
            type="button"
          >
            <span className="social-auth-logo" aria-hidden="true">{renderKakaoLogo()}</span>
            <span>카카오로 가입</span>
          </button>
        </div>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

function renderPolicyContent(content: string) {
  if (containsHtmlMarkup(content)) {
    return (
      <div
        className="signup-policy-content html"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <pre className="signup-policy-content">{content}</pre>;
}

function containsHtmlMarkup(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function renderGoogleLogo() {
  return (
    <svg className="social-auth-logo-svg google-logo-svg" viewBox="0 0 24 24" role="img">
      <path fill="#4285f4" d="M23.5 12.27c0-.82-.07-1.43-.22-2.06H12v4.08h6.62c-.13 1.04-.85 2.61-2.45 3.66l-.02.14 3.56 2.67.25.02c2.3-2.06 3.54-5.08 3.54-8.51Z" />
      <path fill="#34a853" d="M12 24c3.29 0 6.05-1.05 8.06-2.86l-3.84-2.88c-1.03.69-2.4 1.17-4.22 1.17a7.31 7.31 0 0 1-6.91-4.87l-.14.01-3.7 2.78-.05.13A12.15 12.15 0 0 0 12 24Z" />
      <path fill="#fbbc05" d="M5.09 14.56A7.2 7.2 0 0 1 4.7 12c0-.89.14-1.75.37-2.56l-.01-.17-3.74-2.81-.12.06A11.76 11.76 0 0 0 0 12c0 1.97.49 3.83 1.34 5.46l3.75-2.9Z" />
      <path fill="#eb4335" d="M12 4.57c2.29 0 3.84.96 4.72 1.76l3.45-3.27C18.05 1.14 15.29 0 12 0A12.15 12.15 0 0 0 1.3 6.52l3.75 2.92A7.34 7.34 0 0 1 12 4.57Z" />
    </svg>
  );
}

function renderNaverLogo() {
  return (
    <svg className="social-auth-logo-svg naver-logo-svg" viewBox="0 0 24 24" role="img">
      <path fill="#ffffff" d="M15.32 12.52 8.42 3H3v18h5.68v-9.52L15.58 21H21V3h-5.68v9.52Z" />
    </svg>
  );
}

function renderKakaoLogo() {
  return (
    <svg className="social-auth-logo-svg kakao-logo-svg" viewBox="0 0 24 24" role="img">
      <path fill="#181600" d="M12 3.1c-5.5 0-9.96 3.52-9.96 7.86 0 2.78 1.83 5.22 4.58 6.62l-.93 3.41c-.08.28.24.5.47.33l4.05-2.69c.58.08 1.18.12 1.79.12 5.5 0 9.96-3.52 9.96-7.86S17.5 3.1 12 3.1Z" />
    </svg>
  );
}
