'use client';

import { useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';
import { navigateToSafeRedirect } from '../auth-redirect';

export function LoginPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('이메일과 비밀번호를 입력해 로그인하세요.');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    dispatchAuthSessionChangedEvent();
    setMessage('로그아웃되었습니다.');
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
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="actions compact login-actions">
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '처리 중' : '로그인'}
          </button>
          <button className="button secondary" type="button" onClick={logout} disabled={isSubmitting}>
            로그아웃
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
