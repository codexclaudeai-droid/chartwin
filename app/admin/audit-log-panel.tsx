'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeAdminAuditLogPresetEvent } from './admin-audit-log-preset-events';
import { subscribeAdminRefreshEvent, type AdminRefreshSource } from './admin-refresh-events';
import {
  AUDIT_LOG_FILTER_PRESETS,
  getAuditLogFilterPreset,
  type AuditLogFilterPreset,
} from './audit-log-filters';
import { formatAuditLogSummary } from './audit-log-summary';

type AuditLogEntry = {
  sequence: number;
  log: {
    actorAdminId: string;
    action: string;
    targetType: string;
    targetId: string;
    beforeJson: unknown;
    afterJson: unknown;
  };
  actor: {
    email: string;
    name: string;
    role: string;
  } | null;
};

type AuditLogResponse = {
  ok: boolean;
  message?: string;
  entries?: AuditLogEntry[];
};

type AuditLogFilterInput = Pick<AuditLogFilterPreset, 'action' | 'targetType'>;
type AuditLogRefreshOptions = AuditLogFilterInput & {
  nextMessage?: string;
};

const AUDIT_LOG_REFRESH_SOURCE_LABELS: Record<AdminRefreshSource, string> = {
  payments: '결제 작업',
  subscriptions: '구독 작업',
  support: '고객센터 작업',
  users: '회원 작업',
};

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [message, setMessage] = useState('관리자 로그인 후 감사 로그를 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const latestFilterRef = useRef<AuditLogFilterInput>({ action: '', targetType: '' });
  latestFilterRef.current = { action, targetType };

  useEffect(() => {
    void refresh();
    const unsubscribeRefresh = subscribeAdminRefreshEvent((detail) => {
      const nextMessage = detail.source ? formatAuditLogRefreshMessage(detail.source) : undefined;
      void refresh({ ...latestFilterRef.current, nextMessage });
    });
    const unsubscribeAuditPreset = subscribeAdminAuditLogPresetEvent((detail) => {
      const preset = getAuditLogFilterPreset(detail.presetKey);
      setAction(preset.action);
      setTargetType(preset.targetType);
      void refresh({ action: preset.action, targetType: preset.targetType, nextMessage: `${preset.label} 감사 로그 필터를 적용했습니다.` });
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeAuditPreset();
    };
  }, []);

  async function refresh(nextFilter: AuditLogRefreshOptions = latestFilterRef.current) {
    setIsBusy(true);
    const params = new URLSearchParams();
    const nextAction = nextFilter.action.trim();
    const nextTargetType = nextFilter.targetType.trim();
    if (nextAction) params.set('action', nextAction);
    if (nextTargetType) params.set('targetType', nextTargetType);

    const endpoint = params.toString() ? `/api/admin/audit-logs?${params}` : '/api/admin/audit-logs';
    const response = await fetch(endpoint, { cache: 'no-store' });
    const payload = await response.json() as AuditLogResponse;
    setIsBusy(false);

    if (!response.ok || !payload.entries) {
      setEntries([]);
      setMessage(payload.message || '관리자 권한이 필요합니다.');
      return;
    }

    setEntries(payload.entries);
    setMessage(nextFilter.nextMessage ?? `감사 로그 ${payload.entries.length}건을 불러왔습니다.`);
  }

  function applyPreset(preset: AuditLogFilterPreset) {
    setAction(preset.action);
    setTargetType(preset.targetType);
    void refresh({ action: preset.action, targetType: preset.targetType });
  }

  return (
    <section className="card wide" id="admin-audit-logs">
      <div className="toolbar">
        <h2>감사 로그</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>새로고침</button>
      </div>
      <div className="quick-filter-row" aria-label="감사 로그 빠른 필터">
        {AUDIT_LOG_FILTER_PRESETS.map((preset) => {
          const isActive = action === preset.action && targetType === preset.targetType;
          return (
            <button
              className={`button secondary${isActive ? ' active' : ''}`}
              type="button"
              key={preset.key}
              aria-pressed={isActive}
              onClick={() => applyPreset(preset)}
              disabled={isBusy}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="admin-filter-row">
        <input
          aria-label="감사 로그 작업 필터"
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="작업명 필터 예: payment, support"
        />
        <input
          aria-label="감사 로그 대상 필터"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
          placeholder="대상 예: payment_request"
        />
        <button className="button" type="button" onClick={() => void refresh()} disabled={isBusy}>검색</button>
      </div>
      <p className="notice">{message}</p>
      <div className="thread-list">
        {entries.map((entry) => (
          <article className="thread-card" key={entry.sequence}>
            <div className="thread-meta">
              <span className="badge">#{entry.sequence}</span>
              <span>{entry.log.action}</span>
              <span>{entry.actor?.email ?? entry.log.actorAdminId}</span>
            </div>
            <h3>{entry.log.targetType} / {entry.log.targetId}</h3>
            <ul className="audit-summary">
              {formatAuditLogSummary({
                action: entry.log.action,
                targetType: entry.log.targetType,
                targetId: entry.log.targetId,
                beforeJson: entry.log.beforeJson,
                afterJson: entry.log.afterJson,
              }).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <details>
              <summary>변경 전후 데이터 보기</summary>
              <pre className="audit-json">{JSON.stringify({
                before: entry.log.beforeJson,
                after: entry.log.afterJson,
              }, null, 2)}</pre>
            </details>
          </article>
        ))}
        {entries.length === 0 && <p className="notice">표시할 감사 로그가 없습니다.</p>}
      </div>
    </section>
  );
}

function formatAuditLogRefreshMessage(source: AdminRefreshSource): string {
  return `${AUDIT_LOG_REFRESH_SOURCE_LABELS[source]} 후 감사로그를 갱신했습니다.`;
}
