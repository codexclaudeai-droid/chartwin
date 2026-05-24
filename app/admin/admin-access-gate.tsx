'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from '../auth-events';
import { getAdminAccessState, type AdminAccessState } from './admin-access-model';

type AdminAccessPayload = {
  authenticated?: boolean;
  user?: {
    role: string;
  } | null;
  message?: string;
};

export function AdminAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<AdminAccessState | 'checking'>('checking');
  const [message, setMessage] = useState('관리자 권한을 확인하는 중입니다.');

  async function refreshAccess() {
    setState('checking');
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setState('login_required');
      setMessage('관리자 페이지를 보려면 먼저 관리자 계정으로 로그인해야 합니다.');
      return;
    }

    const payload = await response.json() as AdminAccessPayload;
    const nextState = getAdminAccessState({
      authenticated: Boolean(payload.authenticated),
      role: payload.user?.role,
    });
    setState(nextState);
    setMessage(nextState === 'allowed'
      ? '관리자 권한이 확인되었습니다.'
      : payload.message || '현재 계정에는 관리자 페이지 접근 권한이 없습니다.');
  }

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
  }, []);

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

  return (
    <section className="card wide">
      <h2>{state === 'login_required' ? '관리자 로그인 필요' : '관리자 권한 필요'}</h2>
      <p className="notice">{message}</p>
      <div className="actions">
        {state === 'login_required' && <Link className="button" href="/login">로그인</Link>}
        <Link className="button secondary" href={state === 'login_required' ? '/' : '/profile'}>
          {state === 'login_required' ? '홈으로 이동' : '내 계정 확인'}
        </Link>
        <Link className="button secondary" href="/support">고객센터</Link>
      </div>
    </section>
  );
}
