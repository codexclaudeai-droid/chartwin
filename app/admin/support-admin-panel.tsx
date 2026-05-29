'use client';

import { useEffect, useRef, useState } from 'react';
import { dispatchAdminAuditLogPresetEvent } from './admin-audit-log-preset-events';
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
  getSupportThreadFilterCount,
  getSupportThreadFilterPreset,
  SUPPORT_THREAD_FILTER_PRESETS,
} from './support-thread-filters';
import {
  ADMIN_SUPPORT_THREAD_QUERY_PARAM,
  createAdminSupportThreadUrl,
  getAdminSupportReplyInputId,
  getAdminSupportThreadDomId,
} from './support-thread-links';

type SupportThreadListItem = {
  thread: {
    id: string;
    authorUserId: string;
    title: string;
    status: string;
    visibility: string;
    createdAt: string;
  };
  author: {
    email: string;
  } | null;
  messages: Array<{
    id: string;
    authorUserId: string;
    body: string;
    isAdminReply: boolean;
  }>;
};

type SupportAdminPanelRefreshOptions = {
  nextMessage?: string;
};

export function SupportAdminPanel() {
  const replyInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const handledDeepLinkRef = useRef<string | null>(null);
  const [threads, setThreads] = useState<SupportThreadListItem[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [deepLinkedThreadId, setDeepLinkedThreadId] = useState<string | null>(null);
  const [highlightedThreadId, setHighlightedThreadId] = useState<string | null>(null);
  const [replyByThreadId, setReplyByThreadId] = useState<Record<string, string>>({});
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [threadEditById, setThreadEditById] = useState<Record<string, { title: string; body: string }>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyEditById, setReplyEditById] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (threads.length === 0 || typeof window === 'undefined') return;
    const targetThreadId = new URLSearchParams(window.location.search).get(ADMIN_SUPPORT_THREAD_QUERY_PARAM);
    if (!targetThreadId || handledDeepLinkRef.current === targetThreadId) return;

    handledDeepLinkRef.current = targetThreadId;
    setActiveFilterKey('all');
    setDashboardFilterNotice(null);
    setDeepLinkedThreadId(targetThreadId);
    setHighlightedThreadId(targetThreadId);

    window.setTimeout(() => {
      const targetCard = document.getElementById(getAdminSupportThreadDomId(targetThreadId));
      if (!targetCard) {
        setMessage(`${targetThreadId} 문의를 찾을 수 없거나 조회 권한이 없습니다.`);
        return;
      }

      targetCard.scrollIntoView({ block: 'center', behavior: 'smooth' });
      replyInputRefs.current[targetThreadId]?.focus();
      setMessage(`${targetThreadId} 문의로 이동했습니다. 바로 답변할 수 있습니다.`);
    }, 0);
  }, [threads]);

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

  function getThreadEditMessage(item: SupportThreadListItem) {
    return item.messages.find((threadMessage) => threadMessage.authorUserId === item.thread.authorUserId)
      ?? item.messages.find((threadMessage) => !threadMessage.isAdminReply)
      ?? null;
  }

  function startThreadEdit(item: SupportThreadListItem) {
    const threadMessage = getThreadEditMessage(item);
    setEditingThreadId(item.thread.id);
    setThreadEditById((current) => ({
      ...current,
      [item.thread.id]: {
        title: item.thread.title,
        body: threadMessage?.body ?? '',
      },
    }));
  }

  async function saveThreadEdit(threadId: string) {
    const draft = threadEditById[threadId];
    if (!draft || !draft.title.trim() || !draft.body.trim()) {
      setMessage('문의 제목과 내용을 입력해 주세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, title: draft.title, body: draft.body }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 수정에 실패했습니다.');
      return;
    }
    setEditingThreadId(null);
    void refresh({ nextMessage: `${threadId} 문의글을 수정했습니다.` });
    dispatchAdminRefreshEvent({ source: 'support' });
  }

  async function deleteThread(threadId: string) {
    if (!window.confirm('문의글을 삭제할까요? 관련 대화가 목록에서 사라집니다.')) return;

    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 삭제에 실패했습니다.');
      return;
    }
    setEditingThreadId(null);
    void refresh({ nextMessage: `${threadId} 문의글을 삭제했습니다.` });
    dispatchAdminRefreshEvent({ source: 'support' });
  }

  function startReplyEdit(threadMessage: SupportThreadListItem['messages'][number]) {
    setEditingReplyId(threadMessage.id);
    setReplyEditById((current) => ({
      ...current,
      [threadMessage.id]: threadMessage.body,
    }));
  }

  async function saveReplyEdit(messageId: string, threadId: string) {
    const body = normalizeSupportReply(replyEditById[messageId] || '');
    if (!canSubmitSupportReply(body)) {
      setMessage('수정할 답변 내용을 입력해 주세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/support/reply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, threadId, body }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '답변 수정에 실패했습니다.');
      return;
    }
    setEditingReplyId(null);
    void refresh({ nextMessage: '관리자 답변을 수정했습니다.' });
    dispatchAdminRefreshEvent({ source: 'support' });
  }

  async function deleteReply(messageId: string, threadId: string) {
    if (!window.confirm('관리자 답변을 삭제할까요?')) return;

    setIsBusy(true);
    const response = await fetch('/api/admin/support/reply', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, threadId }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '답변 삭제에 실패했습니다.');
      return;
    }
    setEditingReplyId(null);
    void refresh({ nextMessage: '관리자 답변을 삭제했습니다.' });
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
  const deepLinkedThread = deepLinkedThreadId
    ? threads.find((item) => item.thread.id === deepLinkedThreadId) ?? null
    : null;

  return (
    <section className="card wide admin-support-panel" id="admin-support">
      <div className="toolbar admin-support-toolbar">
        <h2>고객센터 관리</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>새로고침</button>
      </div>
      <p className="notice admin-support-status-notice">{message}</p>
      {deepLinkedThreadId && (
        <div className="admin-deep-link-notice admin-deep-link-card" role="status">
          <div className="admin-deep-link-heading">
            <div>
              <span className="admin-deep-link-kicker">답변 대상 문의</span>
              <strong className="admin-deep-link-title">
                {deepLinkedThread ? deepLinkedThread.thread.title : `${deepLinkedThreadId} 문의`}
              </strong>
            </div>
            {deepLinkedThread && (
              <span className="badge">{formatSupportStatusLabel(deepLinkedThread.thread.status)}</span>
            )}
          </div>
          {deepLinkedThread ? (
            <>
              <div className="admin-deep-link-meta" aria-label="답변 대상 문의 정보">
                <span className="admin-deep-link-target-id">{deepLinkedThread.thread.id}</span>
                <span>{deepLinkedThread.author?.email ?? 'system'}</span>
                <span>{formatSupportVisibilityLabel(deepLinkedThread.thread.visibility)}</span>
              </div>
              <p className="admin-deep-link-context">
                {deepLinkedThread.author?.email ?? 'system'} 문의입니다.{' '}
                {deepLinkedThread.thread.status === 'answered'
                  ? '이미 답변 완료된 문의입니다. 필요한 경우 추가 답변을 남길 수 있습니다.'
                  : '이 문의에 바로 답변할 수 있습니다.'}
              </p>
              <div className="admin-deep-link-actions">
                <a
                  className="text-link compact admin-deep-link-action-primary"
                  href={`#${getAdminSupportReplyInputId(deepLinkedThread.thread.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    replyInputRefs.current[deepLinkedThread.thread.id]?.focus();
                  }}
                >
                  답변 입력창으로 이동
                </a>
                <a
                  className="text-link compact admin-deep-link-action-secondary"
                  href="#admin-audit-logs"
                  onClick={() => dispatchAdminAuditLogPresetEvent({ presetKey: 'support', targetId: deepLinkedThread.thread.id })}
                >
                  이 문의 감사로그 보기
                </a>
              </div>
            </>
          ) : (
            <div className="admin-deep-link-missing">
              <p>{deepLinkedThreadId} 문의를 찾을 수 없거나 조회 권한이 없습니다.</p>
            </div>
          )}
        </div>
      )}
      <div className="quick-filter-row admin-support-filter-row" aria-label="고객센터 빠른 필터">
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
              <span>{preset.label}</span>
              <strong className="quick-filter-count">
                {getSupportThreadFilterCount(threads, preset.key)}
              </strong>
            </button>
          );
        })}
      </div>
      <AdminDashboardFilterNotice
        label={dashboardFilterNotice}
        onClear={clearDashboardFilterNotice}
      />
      <p className="notice compact admin-support-filter-summary">현재 필터: {activeFilter.label} / 표시 {filteredThreads.length}건</p>
      <div className="thread-list admin-support-thread-list">
        {filteredThreads.map((item) => {
          const isEditingThread = editingThreadId === item.thread.id;
          const threadEditDraft = threadEditById[item.thread.id] ?? {
            title: item.thread.title,
            body: getThreadEditMessage(item)?.body ?? '',
          };

          return (
          <article
            className={
              highlightedThreadId === item.thread.id
                ? 'thread-card admin-support-thread-card highlighted'
                : 'thread-card admin-support-thread-card'
            }
            id={getAdminSupportThreadDomId(item.thread.id)}
            key={item.thread.id}
          >
            <header className="admin-support-thread-header">
              <div>
                <span className="admin-support-thread-id">{item.thread.id}</span>
                <h3 className="admin-support-thread-title">{item.thread.title}</h3>
              </div>
              <div className="admin-support-thread-actions">
                <button className="button secondary compact" type="button" onClick={() => startThreadEdit(item)} disabled={isBusy}>
                  게시글 수정
                </button>
                <button className="button danger compact" type="button" onClick={() => void deleteThread(item.thread.id)} disabled={isBusy}>
                  게시글 삭제
                </button>
              </div>
              <a className="text-link compact admin-support-detail-link" href={createAdminSupportThreadUrl(item.thread.id)}>
                상세 답변 링크
              </a>
            </header>
            {isEditingThread ? (
              <div className="admin-support-thread-edit-panel">
                <label>
                  <span>제목</span>
                  <input
                    value={threadEditDraft.title}
                    onChange={(event) => setThreadEditById((current) => ({
                      ...current,
                      [item.thread.id]: {
                        ...threadEditDraft,
                        title: event.target.value,
                      },
                    }))}
                  />
                </label>
                <label>
                  <span>내용</span>
                  <textarea
                    value={threadEditDraft.body}
                    onChange={(event) => setThreadEditById((current) => ({
                      ...current,
                      [item.thread.id]: {
                        ...threadEditDraft,
                        body: event.target.value,
                      },
                    }))}
                  />
                </label>
                <div className="admin-support-thread-edit-actions">
                  <button className="button" type="button" onClick={() => void saveThreadEdit(item.thread.id)} disabled={isBusy}>
                    저장
                  </button>
                  <button className="button secondary" type="button" onClick={() => setEditingThreadId(null)} disabled={isBusy}>
                    취소
                  </button>
                </div>
              </div>
            ) : null}
            <div className="admin-support-meta-bar">
              <span className="badge admin-support-meta-chip">{formatSupportStatusLabel(item.thread.status)}</span>
              <span className="admin-support-meta-chip">{formatSupportVisibilityLabel(item.thread.visibility)}</span>
              <span className="admin-support-meta-chip">작성 {formatDateTime(item.thread.createdAt)}</span>
            </div>
            <div className="admin-support-author-cell">
              <span>작성자</span>
              <strong>{item.author?.email ?? 'system'}</strong>
            </div>
            <div className="admin-support-message-list">
              {item.messages.map((threadMessage) => {
                const isEditingReply = editingReplyId === threadMessage.id;
                const replyEditDraft = replyEditById[threadMessage.id] ?? threadMessage.body;

                return (
                  <article
                    className={threadMessage.isAdminReply ? 'admin-support-message admin-support-admin-reply' : 'admin-support-message'}
                    key={threadMessage.id}
                  >
                    <div className="admin-support-message-heading">
                      <strong>{threadMessage.isAdminReply ? '관리자' : '문의'}</strong>
                      {threadMessage.isAdminReply ? (
                        <div className="admin-support-reply-icon-actions" role="group" aria-label="관리자 답변 관리">
                          <button
                            aria-label="관리자 답변 수정"
                            className="admin-support-reply-icon-button"
                            disabled={isBusy}
                            onClick={() => startReplyEdit(threadMessage)}
                            title="관리자 답변 수정"
                            type="button"
                          >
                            <span aria-hidden="true">✎</span>
                          </button>
                          <button
                            aria-label="관리자 답변 삭제"
                            className="admin-support-reply-icon-button danger"
                            disabled={isBusy}
                            onClick={() => void deleteReply(threadMessage.id, item.thread.id)}
                            title="관리자 답변 삭제"
                            type="button"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <span className="admin-support-message-body">{threadMessage.body}</span>
                    {threadMessage.isAdminReply && isEditingReply ? (
                      <div className="admin-support-reply-edit-panel">
                        <textarea
                          value={replyEditDraft}
                          onChange={(event) => setReplyEditById((current) => ({
                            ...current,
                            [threadMessage.id]: event.target.value,
                          }))}
                        />
                        <div className="admin-support-reply-edit-actions">
                          <button className="button" type="button" onClick={() => void saveReplyEdit(threadMessage.id, item.thread.id)} disabled={isBusy}>
                            저장
                          </button>
                          <button className="button secondary" type="button" onClick={() => setEditingReplyId(null)} disabled={isBusy}>
                            취소
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <div className="reply-row admin-support-reply-row">
              <textarea
                aria-label={`${item.thread.id} 문의 답변 입력`}
                id={getAdminSupportReplyInputId(item.thread.id)}
                ref={(element) => {
                  replyInputRefs.current[item.thread.id] = element;
                }}
                value={replyByThreadId[item.thread.id] || ''}
                onChange={(event) => setReplyByThreadId((current) => ({
                  ...current,
                  [item.thread.id]: event.target.value,
                }))}
                placeholder="관리자 답변"
              />
              <div className="admin-support-reply-actions">
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
            </div>
          </article>
          );
        })}
        {filteredThreads.length === 0 && (
          <article className="admin-support-empty-state">
            <strong>해당 조건의 고객 문의가 없습니다.</strong>
            <p>다른 필터를 선택하거나 새로고침 후 다시 확인해 주세요.</p>
          </article>
        )}
      </div>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
