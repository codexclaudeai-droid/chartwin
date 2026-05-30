'use client';

import { useEffect, useRef, useState } from 'react';

type ChartAccessPayload = {
  ok?: boolean;
  fullChart?: boolean;
  message?: string;
};

type ChartRuntimeStatus = 'checking' | 'allowed' | 'login_required' | 'blocked' | 'error';

export function ChartRuntime() {
  const bootedRef = useRef(false);
  const [status, setStatus] = useState<ChartRuntimeStatus>('checking');
  const [message, setMessage] = useState('차트 접근 권한을 확인하고 있습니다.');

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      try {
        const response = await fetch('/api/chart/access', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as ChartAccessPayload;

        if (!response.ok || payload.fullChart !== true) {
          if (cancelled) return;
          setStatus(response.status === 401 ? 'login_required' : 'blocked');
          setMessage(payload.message || '구독 승인 후 TC Chart를 이용할 수 있습니다.');
          return;
        }

        if (cancelled) return;
        setStatus('allowed');
        window.requestAnimationFrame(() => {
          if (cancelled || bootedRef.current) return;
          bootedRef.current = true;
          void import('../../src/main.ts');
        });
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage('차트 접근 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }

    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={`chart-runtime-page chart-runtime-${status}`} aria-label="TC Chart 런타임">
      {status !== 'allowed' && (
        <section className="chart-access-gate" role="status">
          <span className="eyebrow">TC Chart Access</span>
          <h1>{status === 'checking' ? '접근 권한 확인 중' : '차트 이용 권한이 필요합니다'}</h1>
          <p>{message}</p>
          {status !== 'checking' && (
            <div className="chart-access-actions">
              {status === 'login_required' && <a className="button" href="/login?redirect=/chart">로그인</a>}
              <a className="button secondary" href="/pricing">구독하기</a>
              <a className="button secondary" href="/support">고객센터</a>
            </div>
          )}
        </section>
      )}
      <div id="app" className="chart-runtime-root" hidden={status !== 'allowed'} />
    </main>
  );
}
