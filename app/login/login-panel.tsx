'use client';

import { useState } from 'react';
import { dispatchAuthSessionChangedEvent } from '../auth-events';

const demoUsers = [
  { email: 'member@example.com', label: '일반 회원' },
  { email: 'trial@example.com', label: '체험 회원' },
  { email: 'subscriber@example.com', label: '구독 회원' },
  { email: 'admin@example.com', label: '관리자' },
  { email: 'super@example.com', label: '최고관리자' },
];

export function LoginPanel() {
  const [email, setEmail] = useState(demoUsers[0].email);
  const [password, setPassword] = useState('Demo1234!');
  const [message, setMessage] = useState('이메일과 비밀번호로 세션 쿠키를 발급합니다. 데모 비밀번호는 Demo1234! 입니다.');
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
    if (response.ok) dispatchAuthSessionChangedEvent();
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
    <section className="card">
      <form className="form" onSubmit={login}>
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label htmlFor="demoEmail">데모 계정 빠른 선택</label>
        <select id="demoEmail" value={email} onChange={(event) => setEmail(event.target.value)}>
          {demoUsers.map((user) => (
            <option key={user.email} value={user.email}>{user.label} - {user.email}</option>
          ))}
        </select>
        <div className="actions compact">
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
