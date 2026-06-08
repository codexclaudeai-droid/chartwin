'use client';

import { useEffect, useRef, useState } from 'react';
import { FreeTrialRequestButton } from '../shared/free-trial-request-button';

type ChartAccessPayload = {
  ok?: boolean;
  fullChart?: boolean;
  message?: string;
};

type ChartRuntimeStatus = 'checking' | 'allowed' | 'login_required' | 'blocked' | 'error';

type ChartRuntimeProps = {
  accessVerified?: boolean;
};

export function ChartRuntime({ accessVerified = false }: ChartRuntimeProps) {
  const bootedRef = useRef(false);
  const [status, setStatus] = useState<ChartRuntimeStatus>(() => (
    accessVerified ? 'allowed' : 'checking'
  ));
  const [message, setMessage] = useState('차트 접근 권한을 확인하고 있습니다.');

  useEffect(() => {
    let cancelled = false;

    function bootChartEngine() {
      window.requestAnimationFrame(() => {
        if (cancelled || bootedRef.current) return;
        bootedRef.current = true;
        void import('../../src/main.ts')
          .catch((error) => {
            if (cancelled) return;
            bootedRef.current = false;
            setStatus('error');
            setMessage(formatChartRuntimeBootError(error));
          });
      });
    }

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
        bootChartEngine();
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage('차트 접근 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }

    if (accessVerified) {
      setStatus('allowed');
      bootChartEngine();
      return () => {
        cancelled = true;
      };
    }

    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [accessVerified]);

  return (
    <main className={`chart-runtime-page chart-runtime-${status}`} aria-label="TC Chart 런타임">
      {status !== 'allowed' && (
        <section className="chart-access-gate" role="status">
          <span className="eyebrow">TC Chart Access</span>
          <h1>{getChartRuntimeStatusTitle(status)}</h1>
          <p>{message}</p>
          {status !== 'checking' && (
            <div className="chart-access-actions">
              {status === 'login_required' && <a className="button" href="/login?redirect=/chart">로그인</a>}
              <a className="button secondary" href="/pricing">구독하기</a>
              <FreeTrialRequestButton className="button secondary">무료체험 신청</FreeTrialRequestButton>
            </div>
          )}
        </section>
      )}
      <div id="app" className="chart-runtime-root" hidden={status !== 'allowed'} />
    </main>
  );
}

function getChartRuntimeStatusTitle(status: ChartRuntimeStatus): string {
  if (status === 'checking') return '접근 권한 확인 중';
  if (status === 'error') return '차트 로딩 오류';
  return '차트 이용 권한이 필요합니다';
}

function formatChartRuntimeBootError(error: unknown): string {
  const detail = getErrorMessage(error);
  return detail
    ? `차트 런타임을 불러오지 못했습니다. 잠시 후 새로고침해 주세요. (${detail})`
    : '차트 런타임을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return '';
    }
  }
  return '';
}
