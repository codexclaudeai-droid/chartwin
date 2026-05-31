'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  dispatchAuthSessionChangedEvent,
  subscribeAuthSessionChangedEvent,
} from './auth-events';
import { formatSessionRoleLabel, formatSessionUserLabel, type SessionNavUser } from './session-nav-model';

type SessionPayload = {
  authenticated?: boolean;
  user?: (SessionNavUser & {
    id: string;
    role: string;
    accountStatus: string;
  }) | null;
};

export function SessionNav() {
  const [user, setUser] = useState<SessionPayload['user']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  async function refreshSession() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const payload = await response.json() as SessionPayload;
    setUser(payload.authenticated ? payload.user ?? null : null);
    setIsLoading(false);
  }

  useEffect(() => {
    let isMounted = true;
    const safeRefresh = async () => {
      if (isMounted) await refreshSession();
    };

    void safeRefresh();
    const unsubscribe = subscribeAuthSessionChangedEvent(() => {
      void safeRefresh();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function logout() {
    setIsBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsBusy(false);
    dispatchAuthSessionChangedEvent();
    await refreshSession();
  }

  if (isLoading) {
    return <div className="session session-muted">세션 확인</div>;
  }

  if (user) {
    return (
      <div className="session session-auth">
        <Link className="session-user" href="/profile">
          <span className="session-avatar" aria-hidden="true">
            {user.profileImageDataUrl ? (
              <img alt="" src={user.profileImageDataUrl} />
            ) : (
              <DefaultSessionAvatarIcon />
            )}
          </span>
          <span className="session-user-name">{formatSessionUserLabel(user)}</span>
          <span className="session-role">{formatSessionRoleLabel(user.role)}</span>
        </Link>
        <button
          aria-label={isBusy ? '로그아웃 처리 중' : '로그아웃'}
          className="session-button session-logout-button"
          title={isBusy ? '로그아웃 처리 중' : '로그아웃'}
          type="button"
          onClick={logout}
          disabled={isBusy}
        >
          <LogoutIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="session">
      <Link href="/login">로그인</Link>
      <HeaderSignupEclipseButton />
    </div>
  );
}

function DefaultSessionAvatarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20c1.15-4.35 3.55-6.5 7.2-6.5s6.05 2.15 7.2 6.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M10 6H6.8A1.8 1.8 0 0 0 5 7.8v8.4A1.8 1.8 0 0 0 6.8 18H10" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}

function HeaderSignupEclipseButton() {
  return (
    <span className="tc-header-signup-wrap">
      <span className="tc-header-signup-glow" aria-hidden="true">
        <span className="tc-header-eclipse tc-header-eclipse-glow" />
      </span>
      <Link className="tc-header-signup-pill" href="/signup" aria-label="회원가입">
        <span className="tc-header-eclipse" aria-hidden="true" />
        <span className="tc-header-signup-label">회원가입</span>
      </Link>
    </span>
  );
}
