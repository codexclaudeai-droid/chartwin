'use client';

import { useState } from 'react';

export function ForgotPasswordPanel() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Enter your account email to request a password reset token.');
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
      setMessage(`Reset request accepted. Local preview token: ${payload.resetTokenPreview}`);
      return;
    }
    setMessage(payload.message ?? 'Reset request accepted.');
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
    setMessage(response.ok ? 'Password has been reset. You can log in with the new password.' : payload.message);
  }

  return (
    <section className="card">
      <form className="form" onSubmit={requestReset}>
        <label htmlFor="resetEmail">Account email</label>
        <input
          id="resetEmail"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="member@example.com"
        />
        <button className="button" type="submit" disabled={isSubmitting}>
          Request reset
        </button>
      </form>

      <form className="form" onSubmit={confirmReset}>
        <label htmlFor="resetToken">Reset token</label>
        <input
          id="resetToken"
          name="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="NewDemo1234!"
        />
        <button className="button secondary" type="submit" disabled={isSubmitting}>
          Reset password
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

