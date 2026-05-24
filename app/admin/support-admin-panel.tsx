'use client';

import { useEffect, useState } from 'react';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
import { dispatchAdminRefreshEvent, subscribeAdminRefreshEvent } from './admin-refresh-events';
import {
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
} from './admin-status-labels';
import { getDefaultSupportReplyBody } from './support-reply-defaults';
import { canSubmitSupportReply, normalizeSupportReply } from './support-reply-policy';
import {
  filterSupportThreads,
  getSupportThreadFilterPreset,
  SUPPORT_THREAD_FILTER_PRESETS,
} from './support-thread-filters';

type SupportThreadListItem = {
  thread: {
    id: string;
    title: string;
    status: string;
    visibility: string;
  };
  author: {
    email: string;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    isAdminReply: boolean;
  }>;
};

type SupportAdminPanelRefreshOptions = {
  nextMessage?: string;
};

export function SupportAdminPanel() {
  const [threads, setThreads] = useState<SupportThreadListItem[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [replyByThreadId, setReplyByThreadId] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('관리자 세션으로 고객 문의를 조회하고 답변할 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
    const unsubscribeRefresh = subscribeAdminRefreshEvent((detail) => {
      if (detail.source === 'support') return;
      void refresh();
    });
    const unsubscribeQueuePreset = subscribeAdminQueuePresetEvent((detail) => {
      if (detail.panel !== 'support') return;
      const dashboardFilter = getSupportThreadFilterPreset(detail.presetKey);
      setActiveFilterKey(dashboardFilter.key);
      setDashboardFilterNotice(dashboardFilter.label);
      void refresh();
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeQueuePreset();
    };
  }, []);

  async function refresh(options: SupportAdminPanelRefreshOptions = {}) {
    setIsBusy(true);
    const response = await fetch('/api/support/threads');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 목록 조회에 실패했습니다.');
      return;
    }
    setThreads(payload.threads || []);
    setMessage(options.nextMessage ?? `고객 문의 ${payload.threads.length}건을 불러왔습니다.`);
  }

  async function reply(threadId: string, fallbackBody = '') {
    const body = normalizeSupportReply(replyByThreadId[threadId] || fallbackBody);
    if (!canSubmitSupportReply(body)) {
      setMessage('관리자 답변 내용을 입력한 뒤 전송해주세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/support/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, body }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '답변 등록에 실패했습니다.');
      return;
    }
    setReplyByThreadId((current) => ({ ...current, [threadId]: '' }));
    void refresh({ nextMessage: `${threadId} 문의에 답변했습니다. 목록을 갱신했습니다.` });
    dispatchAdminRefreshEvent({ source: 'support' });
  }

  function applyQuickFilter(presetKey: string) {
    setDashboardFilterNotice(null);
    setActiveFilterKey(presetKey);
  }

  function clearDashboardFilterNotice() {
    setDashboardFilterNotice(null);
    setActiveFilterKey('all');
  }

  const activeFilter = getSupportThreadFilterPreset(activeFilterKey);
  const filteredThreads = filterSupportThreads(threads, activeFilterKey);

  return (
    <section className="card wide" id="admin-support">
      <div className="toolbar">
        <h2>고객센터 관리</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>새로고침</button>
      </div>
      <p className="notice">{message}</p>
      <div className="quick-filter-row" aria-label="고객센터 빠른 필터">
        {SUPPORT_THREAD_FILTER_PRESETS.map((preset) => {
          const isActive = activeFilter.key === preset.key;
          return (
            <button
              className={`button secondary${isActive ? ' active' : ''}`}
              type="button"
              key={preset.key}
              aria-pressed={isActive}
              onClick={() => applyQuickFilter(preset.key)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <AdminDashboardFilterNotice
        label={dashboardFilterNotice}
        onClear={clearDashboardFilterNotice}
      />
      <p className="notice compact">현재 필터: {activeFilter.label} / 표시 {filteredThreads.length}건</p>
      <div className="thread-list">
        {filteredThreads.map((item) => (
          <article className="thread-card" key={item.thread.id}>
            <div className="thread-meta">
              <span className="badge">{formatSupportStatusLabel(item.thread.status)}</span>
              <span>{formatSupportVisibilityLabel(item.thread.visibility)}</span>
              <span>{item.author?.email ?? 'system'}</span>
            </div>
            <h3>{item.thread.title}</h3>
            {item.messages.map((threadMessage) => (
              <p className={threadMessage.isAdminReply ? 'admin-reply' : undefined} key={threadMessage.id}>
                {threadMessage.isAdminReply ? '관리자: ' : '문의: '}
                {threadMessage.body}
              </p>
            ))}
            <div className="reply-row">
              <textarea
                value={replyByThreadId[item.thread.id] || ''}
                onChange={(event) => setReplyByThreadId((current) => ({
                  ...current,
                  [item.thread.id]: event.target.value,
                }))}
                placeholder="관리자 답변"
              />
              <button className="button" type="button" onClick={() => reply(item.thread.id)} disabled={isBusy || !canSubmitSupportReply(replyByThreadId[item.thread.id] || '')}>
                답변
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => reply(item.thread.id, getDefaultSupportReplyBody())}
                disabled={isBusy}
              >
                빠른 답변
              </button>
            </div>
          </article>
        ))}
        {filteredThreads.length === 0 && <p className="notice">해당 조건의 고객 문의가 없습니다.</p>}
      </div>
    </section>
  );
}
