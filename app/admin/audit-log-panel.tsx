'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeAdminAuditLogPresetEvent } from './admin-audit-log-preset-events';
import { formatAdminDisplayId } from './admin-display-id';
import { AdminRefreshButton } from './admin-refresh-button';
import { subscribeAdminRefreshEvent, type AdminRefreshSource } from './admin-refresh-events';
import {
  AUDIT_LOG_FILTER_PRESETS,
  getAuditLogFilterPreset,
  type AuditLogFilterPreset,
} from './audit-log-filters';
import { formatAuditLogSummary } from './audit-log-summary';
import { getAdminAuditTargetLink } from './audit-target-links';

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

type AuditLogFilterInput = Pick<AuditLogFilterPreset, 'action' | 'targetType'> & {
  targetId: string;
};
type AuditLogRefreshOptions = AuditLogFilterInput & {
  nextMessage?: string;
};

const AUDIT_LOG_REFRESH_SOURCE_LABELS: Record<AdminRefreshSource, string> = {
  payments: '결제 작업',
  subscriptions: '구독 작업',
  support: '고객센터 작업',
  users: '회원 작업',
  webInfo: '웹정보 설정',
};

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('관리자 로그인 후 감사 로그를 확인할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const latestFilterRef = useRef<AuditLogFilterInput>({ action: '', targetType: '', targetId: '' });
  latestFilterRef.current = { action, targetType, targetId };

  useEffect(() => {
    void refresh();
    const unsubscribeRefresh = subscribeAdminRefreshEvent((detail) => {
      const nextMessage = detail.source ? formatAuditLogRefreshMessage(detail.source) : undefined;
      void refresh({ ...latestFilterRef.current, nextMessage });
    });
    const unsubscribeAuditPreset = subscribeAdminAuditLogPresetEvent((detail) => {
      const preset = getAuditLogFilterPreset(detail.presetKey);
      const nextTargetId = detail.targetId ?? '';
      setAction(preset.action);
      setTargetType(preset.targetType);
      setTargetId(nextTargetId);
      void refresh({ action: preset.action, targetType: preset.targetType, targetId: nextTargetId, nextMessage: `${preset.label} 감사 로그 필터를 적용했습니다.` });
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
    const nextTargetId = nextFilter.targetId.trim();
    if (nextAction) params.set('action', nextAction);
    if (nextTargetType) params.set('targetType', nextTargetType);
    if (nextTargetId) params.set('targetId', nextTargetId);

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
    setTargetId('');
    void refresh({ action: preset.action, targetType: preset.targetType, targetId: '' });
  }

  return (
    <section className="card wide" id="admin-audit-logs">
      <div className="toolbar">
        <h2>감사 로그</h2>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
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
              <span>{preset.label}</span>
              <small className="audit-log-preset-query">
                {formatPresetQuery(preset)}
              </small>
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
        <input
          aria-label="감사 로그 대상 ID 필터"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          placeholder="대상 ID 예: support_123"
        />
        <button className="button" type="button" onClick={() => void refresh()} disabled={isBusy}>검색</button>
      </div>
      <p className="notice">{message}</p>
      <div className="thread-list">
        {entries.map((entry) => {
          const auditTargetLink = getAdminAuditTargetLink(entry.log.targetType, entry.log.targetId);

          return (
            <article className="thread-card audit-log-card" key={entry.sequence}>
              <header className="audit-log-header">
                <div>
                  <span className="badge audit-log-sequence-badge">
                    {formatAdminDisplayId('작업', entry.sequence)}
                  </span>
                  <h3>{entry.log.action}</h3>
                </div>
                {auditTargetLink && (
                  <a className="text-link compact" href={auditTargetLink.href}>
                    {auditTargetLink.label}
                  </a>
                )}
              </header>
              <div className="audit-log-meta-grid">
                <div className="audit-log-target-cell">
                  <span>대상</span>
                  <strong>{entry.log.targetType}</strong>
                  <code>{entry.log.targetId}</code>
                </div>
                <div className="audit-log-actor-cell">
                  <span>처리자</span>
                  <strong>{entry.actor?.email ?? entry.log.actorAdminId}</strong>
                  {entry.actor && <small>{entry.actor.name} / {entry.actor.role}</small>}
                </div>
              </div>
              {auditTargetLink && (
                <span className="audit-log-target-link-copy">연결된 운영 화면에서 원본 요청을 함께 확인할 수 있습니다.</span>
              )}
              <ul className="audit-summary audit-log-summary-list">
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
              <details className="audit-log-json-details">
                <summary>변경 전후 데이터 보기</summary>
                <pre className="audit-json">{JSON.stringify({
                  before: entry.log.beforeJson,
                  after: entry.log.afterJson,
                }, null, 2)}</pre>
              </details>
            </article>
          );
        })}
        {entries.length === 0 && <p className="notice">표시할 감사 로그가 없습니다.</p>}
      </div>
    </section>
  );
}

function formatAuditLogRefreshMessage(source: AdminRefreshSource): string {
  return `${AUDIT_LOG_REFRESH_SOURCE_LABELS[source]} 후 감사로그를 갱신했습니다.`;
}

function formatPresetQuery(preset: AuditLogFilterPreset): string {
  if (!preset.action && !preset.targetType) return '모든 기록';
  return [preset.action, preset.targetType].filter(Boolean).join(' / ');
}
