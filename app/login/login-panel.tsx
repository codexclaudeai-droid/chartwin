'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';
import { clearAuthSessionCache, primeAuthSession } from '../auth-session-client';
import { navigateToSafeRedirect } from '../auth-redirect';

export function LoginPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(formData.get('email') || email),
        password: String(formData.get('password') || password),
      }),
    });
    const payload = await response.json();
    setIsSubmitting(false);
    if (response.ok) {
      primeAuthSession({
        authenticated: true,
        actor: payload.user ? { id: payload.user.id, role: payload.user.role } : null,
        user: payload.user ?? null,
      });
      dispatchAuthSessionChangedEvent();
      if (isAdminRole(payload.user?.role)) {
        window.location.assign('/admin');
        return;
      }
      if (navigateToSafeRedirect(new URLSearchParams(window.location.search))) return;
      window.location.assign('/');
      return;
    }
    setMessage(response.ok ? `${payload.user.email} 계정으로 로그인되었습니다.` : payload.message);
  }

  async function logout() {
    setIsSubmitting(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsSubmitting(false);
    clearAuthSessionCache();
    dispatchAuthSessionChangedEvent();
    setMessage('로그아웃되었습니다.');
  }

  function announceSocialAuthPreparation(providerName: string) {
    setMessage(`${providerName} 간편로그인은 서비스 준비중입니다.`);
  }

  return (
    <section className="card auth-card">
      <form className="form" method="post" onSubmit={login}>
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="password">비밀번호</label>
        <div className="password-input-shell">
          <input
            id="password"
            name="password"
            type={isPasswordVisible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            aria-label={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={isPasswordVisible}
            className="password-visibility-toggle"
            onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
            type="button"
          >
            {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        <div className="actions compact login-actions">
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '처리 중' : '로그인'}
          </button>
          <button className="button secondary" type="button" onClick={logout} disabled={isSubmitting}>
            로그아웃
          </button>
        </div>
        <div className="social-auth-divider" role="separator" aria-label="간편로그인"></div>
        <p className="social-auth-helper">SNS(소셜네트워크 서비스) 계정으로 간편 로그인</p>
        <div className="login-social-auth-actions" aria-label="간편로그인">
          <button
            aria-label="Google 간편로그인"
            className="social-auth-icon-button social-auth-icon-google"
            onClick={() => announceSocialAuthPreparation('Google')}
            title="Google"
            type="button"
          >
            <svg className="social-auth-logo-svg google-logo-svg" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path fill="#4285f4" d="M23.5 12.27c0-.82-.07-1.43-.22-2.06H12v4.08h6.62c-.13 1.04-.85 2.61-2.45 3.66l-.02.14 3.56 2.67.25.02c2.3-2.06 3.54-5.08 3.54-8.51Z" />
              <path fill="#34a853" d="M12 24c3.29 0 6.05-1.05 8.06-2.86l-3.84-2.88c-1.03.69-2.4 1.17-4.22 1.17a7.31 7.31 0 0 1-6.91-4.87l-.14.01-3.7 2.78-.05.13A12.15 12.15 0 0 0 12 24Z" />
              <path fill="#fbbc05" d="M5.09 14.56A7.2 7.2 0 0 1 4.7 12c0-.89.14-1.75.37-2.56l-.01-.17-3.74-2.81-.12.06A11.76 11.76 0 0 0 0 12c0 1.97.49 3.83 1.34 5.46l3.75-2.9Z" />
              <path fill="#eb4335" d="M12 4.57c2.29 0 3.84.96 4.72 1.76l3.45-3.27C18.05 1.14 15.29 0 12 0A12.15 12.15 0 0 0 1.3 6.52l3.75 2.92A7.34 7.34 0 0 1 12 4.57Z" />
            </svg>
          </button>
          <button
            aria-label="네이버 간편로그인"
            className="social-auth-icon-button social-auth-icon-naver"
            onClick={() => announceSocialAuthPreparation('네이버')}
            title="네이버"
            type="button"
          >
            <svg className="social-auth-logo-svg naver-logo-svg" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path fill="#ffffff" d="M15.32 12.52 8.42 3H3v18h5.68v-9.52L15.58 21H21V3h-5.68v9.52Z" />
            </svg>
          </button>
          <button
            aria-label="카카오 간편로그인"
            className="social-auth-icon-button social-auth-icon-kakao"
            onClick={() => announceSocialAuthPreparation('카카오')}
            title="카카오"
            type="button"
          >
            <svg className="social-auth-logo-svg kakao-logo-svg" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path fill="#181600" d="M12 3.1c-5.5 0-9.96 3.52-9.96 7.86 0 2.78 1.83 5.22 4.58 6.62l-.93 3.41c-.08.28.24.5.47.33l4.05-2.69c.58.08 1.18.12 1.79.12 5.5 0 9.96-3.52 9.96-7.86S17.5 3.1 12 3.1Z" />
            </svg>
          </button>
        </div>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

function isAdminRole(role: unknown): boolean {
  return role === 'admin' || role === 'super_admin';
}
