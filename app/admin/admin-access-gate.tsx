'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from '../auth-events';
import { getAuthSession } from '../auth-session-client';
import { getAdminAccessState, type AdminAccessState } from './admin-access-model';

type AdminAccessPayload = {
  authenticated?: boolean;
  actor?: {
    role?: string;
  } | null;
  user?: {
    role?: string;
  } | null;
  message?: string;
};

export function AdminAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const [state, setState] = useState<AdminAccessState | 'checking'>('checking');
  const [message, setMessage] = useState('관리자 권한을 확인하는 중입니다.');

  const redirectToLogin = useCallback(() => {
    router.replace('/login?redirect=/admin');
  }, [router]);

  const refreshAccess = useCallback(async () => {
    setState('checking');
    const payload = await getAuthSession() as AdminAccessPayload;
    if (!payload.authenticated) {
      setState('login_required');
      setMessage('관리자 페이지는 로그인 후 접속할 수 있습니다. 로그인 페이지로 이동합니다.');
      redirectToLogin();
      return;
    }

    const nextState = getAdminAccessState({
      authenticated: Boolean(payload.authenticated),
      role: payload.user?.role ?? payload.actor?.role,
    });
    setState(nextState);
    if (nextState === 'login_required') {
      setMessage(payload.message || '관리자 페이지는 로그인 후 접속할 수 있습니다. 로그인 페이지로 이동합니다.');
      redirectToLogin();
      return;
    }

    setMessage(nextState === 'allowed'
      ? '관리자 권한이 확인되었습니다.'
      : payload.message || '현재 계정에는 관리자 페이지 접근 권한이 없습니다.');
  }, [redirectToLogin]);

  useEffect(() => {
    let isMounted = true;
    const safeRefresh = async () => {
      if (isMounted) await refreshAccess();
    };

    void safeRefresh();
    const unsubscribe = subscribeAuthSessionChangedEvent(() => {
      void safeRefresh();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [refreshAccess]);

  if (state === 'allowed') {
    return <>{children}</>;
  }

  if (state === 'checking') {
    return (
      <section className="card wide">
        <h2>관리자 권한 확인</h2>
        <p className="notice">{message}</p>
      </section>
    );
  }

  if (state === 'login_required') {
    return (
      <section className="card wide">
        <h2>관리자 로그인으로 이동 중</h2>
        <p className="notice">{message}</p>
      </section>
    );
  }

  return (
    <section className="card wide">
      <h2>관리자 권한 필요</h2>
      <p className="notice">{message}</p>
      <div className="actions">
        <Link className="button secondary" href="/profile">마이프로필 확인</Link>
        <Link className="button secondary" href="/support">고객센터</Link>
      </div>
    </section>
  );
}
