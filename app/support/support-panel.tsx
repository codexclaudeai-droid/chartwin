'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAuthSession } from '../auth-session-client';
import { DeleteActionIcon, EditActionIcon } from '../shared/action-icons';
import { IconButton } from '../shared/icon-button';
import { RefreshIconButton } from '../shared/refresh-icon-button';
import { AuthPromptModal } from '../shared/auth-prompt-modal';
import {
  formatSupportCategoryLabel,
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
} from './support-display-labels';
import {
  SUPPORT_THREAD_FILTER_PRESETS,
  filterSupportThreads,
  sortSupportThreadsByCreatedAtDesc,
} from '../admin/support-thread-filters';

type AuthSessionState = {
  authenticated: boolean;
  user: {
    id: string;
    role: string;
  } | null;
};

type SupportThreadListItem = {
  thread: {
    id: string;
    authorUserId: string;
    category: string;
    title: string;
    visibility: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  author: {
    email: string;
    name: string;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    isAdminReply: boolean;
    createdAt: string;
  }>;
};

const SUPPORT_THREAD_PAGE_SIZE = 10;
const SUPPORT_THREAD_PAGE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SUPPORT_THREAD_READ_STORAGE_KEY = 'my-chart-lib.support.read-threads.v1';
const SUPPORT_THREAD_CATEGORY_TABS = [
  { key: 'all', label: '전체' },
  { key: 'deposit', label: formatSupportCategoryLabel('deposit') },
  { key: 'cancel', label: formatSupportCategoryLabel('cancel') },
  { key: 'usage', label: formatSupportCategoryLabel('usage') },
  { key: 'general', label: formatSupportCategoryLabel('general') },
];

export function SupportPanel() {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<SupportThreadListItem[]>([]);
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [currentThreadPage, setCurrentThreadPage] = useState(1);
  const [authSession, setAuthSession] = useState<AuthSessionState | null>(null);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(() => new Set());
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(() => new Set());
  const [threadEditById, setThreadEditById] = useState<Record<string, { title: string; body: string }>>({});
  const targetThreadId = searchParams.get('thread');
  const isDepositCategory = category === 'deposit';
  const effectiveVisibility = isDepositCategory ? 'private' : visibility;
  const targetThread = targetThreadId
    ? threads.find((item) => item.thread.id === targetThreadId) ?? null
    : null;
  const latestAdminReply = targetThread?.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;
  const orderedThreads = sortSupportThreadsByCreatedAtDesc(threads);
  const filteredThreads = filterSupportThreads(orderedThreads, activeFilterKey);
  const categoryFilteredThreads = activeCategoryTab === 'all'
    ? filteredThreads
    : filteredThreads.filter((item) => item.thread.category === activeCategoryTab);
  const threadPageCount = Math.max(1, Math.ceil(categoryFilteredThreads.length / SUPPORT_THREAD_PAGE_SIZE));
  const safeCurrentThreadPage = Math.min(currentThreadPage, threadPageCount);
  const paginatedThreads = categoryFilteredThreads.slice(
    (safeCurrentThreadPage - 1) * SUPPORT_THREAD_PAGE_SIZE,
    safeCurrentThreadPage * SUPPORT_THREAD_PAGE_SIZE,
  );

  useEffect(() => {
    void refresh();
    void refreshAuthSession();
    setReadThreadIds(readSupportThreadIds());
  }, []);

  useEffect(() => {
    if (!targetThreadId) return;

    const target = document.getElementById(`support-${targetThreadId}`);
    target?.scrollIntoView({ block: 'center' });
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      next.add(targetThreadId);
      return next;
    });
    markSupportThreadRead(targetThreadId);
  }, [targetThreadId, threads]);

  useEffect(() => {
    setCurrentThreadPage(1);
  }, [activeFilterKey, activeCategoryTab]);

  useEffect(() => {
    if (currentThreadPage <= threadPageCount) return;
    setCurrentThreadPage(threadPageCount);
  }, [currentThreadPage, threadPageCount]);

  async function refresh() {
    setIsBusy(true);
    try {
      const response = await fetch('/api/support/threads');
      const payload = await response.json();
      setThreads(payload.threads || []);
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshAuthSession() {
    try {
      const payload = await getAuthSession();
      setAuthSession({
        authenticated: Boolean(payload.authenticated),
        user: payload.user ?? null,
      });
    } catch {
      setAuthSession({ authenticated: false, user: null });
    }
  }

  async function submitThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createThread({ title, body });
  }

  async function createThread(input: { title: string; body: string }) {
    if (!authSession?.authenticated) {
      setMessage('');
      setShowAuthPromptModal(true);
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title: input.title, body: input.body, visibility: effectiveVisibility }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      if (response.status === 401 || payload.message === 'Session required') {
        setMessage('');
        setShowAuthPromptModal(true);
        return;
      }
      setMessage(payload.message || '문의 등록에 실패했습니다. 먼저 로그인해 주세요.');
      return;
    }
    setTitle('');
    setBody('');
    setMessage('문의가 등록되었습니다. 답변이 오면 알림으로 알려드릴게요.');
    await refresh();
  }

  function getCustomerMessage(item: SupportThreadListItem) {
    return item.messages.find((threadMessage) => !threadMessage.isAdminReply) ?? null;
  }

  function canManageThread(item: SupportThreadListItem): boolean {
    if (!authSession?.authenticated || !authSession.user) return false;
    return authSession.user.id === item.thread.authorUserId ||
      authSession.user.role === 'admin' ||
      authSession.user.role === 'super_admin';
  }

  function toggleThreadExpanded(threadId: string) {
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
        markSupportThreadRead(threadId);
      }
      return next;
    });
  }

  function markSupportThreadRead(threadId: string) {
    setReadThreadIds((current) => {
      if (current.has(threadId)) return current;
      const next = new Set(current);
      next.add(threadId);
      writeSupportThreadIds(next);
      return next;
    });
  }

  function startThreadEdit(item: SupportThreadListItem) {
    const customerMessage = getCustomerMessage(item);
    setEditingThreadId(item.thread.id);
    setThreadEditById((current) => ({
      ...current,
      [item.thread.id]: {
        title: item.thread.title,
        body: customerMessage?.body ?? '',
      },
    }));
  }

  function cancelThreadEdit() {
    setEditingThreadId(null);
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
    setMessage('문의글이 수정되었습니다.');
    await refresh();
  }

  async function deleteThread(threadId: string) {
    if (!window.confirm('문의글을 삭제할까요? 삭제 후 목록에서 사라집니다.')) return;

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
    setMessage('문의글이 삭제되었습니다.');
    await refresh();
  }

  return (
    <section className="grid-panel support-workspace" id="support-inquiry-form">
      <section className="support-panel-frame support-compose-card">
        <div className="support-compose-header">
          <h2>1:1 문의 작성</h2>
          <p className="support-compose-intro">로그인하면 1:1 문의를 남길 수 있습니다. 문의 유형과 공개 범위를 선택한 뒤 필요한 내용을 남겨주세요.</p>
        </div>
        <form className="form support-form-grid" onSubmit={submitThread}>
          <label className="support-field" htmlFor="supportCategory">
            <span>분류</span>
            <select id="supportCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="deposit">{formatSupportCategoryLabel('deposit')}</option>
              <option value="cancel">{formatSupportCategoryLabel('cancel')}</option>
              <option value="usage">{formatSupportCategoryLabel('usage')}</option>
              <option value="general">{formatSupportCategoryLabel('general')}</option>
            </select>
          </label>
          <label className="support-field" htmlFor="supportVisibility">
            <span>공개 범위</span>
            <select
              disabled={isDepositCategory}
              id="supportVisibility"
              value={effectiveVisibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="private">{formatSupportVisibilityLabel('private')}</option>
              <option value="public">{formatSupportVisibilityLabel('public')}</option>
            </select>
            {isDepositCategory ? (
              <small>입금확인은 비공개로만 접수됩니다.</small>
            ) : null}
          </label>
          <label className="support-field support-field-full" htmlFor="supportTitle">
            <span>제목</span>
            <input id="supportTitle" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="support-field support-field-full" htmlFor="supportBody">
            <span>내용</span>
            <textarea id="supportBody" value={body} onChange={(event) => setBody(event.target.value)} required />
          </label>
          <div className="actions compact support-submit-row">
            <button className="button" type="submit" disabled={isBusy}>
              {isBusy ? '처리 중' : '문의 등록'}
            </button>
          </div>
        </form>
        {message ? <p className="notice">{message}</p> : null}
        {showAuthPromptModal ? (
          <AuthPromptModal
            title="로그인 후 문의 등록이 가능합니다."
            description="회원가입 또는 로그인 후 1:1 문의를 등록해 주세요."
            loginHref="/login?redirect=/support"
            signupHref="/signup?redirect=/support"
            onClose={() => setShowAuthPromptModal(false)}
          />
        ) : null}
      </section>

      <section className="support-panel-frame support-thread-card">
        <div className="toolbar support-thread-toolbar">
          <h2>문의 목록</h2>
          <RefreshIconButton onClick={refresh} disabled={isBusy} />
        </div>
        {targetThreadId && (
          <div className="support-deep-link-notice" role="status">
            <span className="support-deep-link-kicker">답변 확인 대상 문의</span>
            {targetThread ? (
              <>
                <div className="thread-meta">
                  <span className="badge">{formatSupportStatusLabel(targetThread.thread.status)}</span>
                  <span>{formatSupportCategoryLabel(targetThread.thread.category)}</span>
                  {targetThread.thread.visibility === 'private' ? <PrivateSupportThreadLockIcon /> : null}
                </div>
                <strong>{formatSupportThreadDisplayTitle(targetThread.thread)}</strong>
                {latestAdminReply ? (
                  <p>
                    <b>최근 관리자 답변</b>: {latestAdminReply.body}
                  </p>
                ) : (
                  <p>아직 관리자 답변이 없는 문의입니다. 답변이 등록되면 알림으로 알려드립니다.</p>
                )}
                <a
                  className="text-link compact"
                  href={`#support-${targetThread.thread.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(`support-${targetThread.thread.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }}
                >
                  문의 카드로 이동
                </a>
              </>
            ) : (
              <p>{targetThreadId} 문의를 찾을 수 없거나 조회 권한이 없습니다.</p>
            )}
          </div>
        )}
        <div className="support-filter-row">
          <label className="support-filter-select-field" htmlFor="support-thread-filter">
            <span>문의 상태</span>
            <select
              id="support-thread-filter"
              value={activeFilterKey}
              onChange={(event) => setActiveFilterKey(event.target.value)}
            >
              {SUPPORT_THREAD_FILTER_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>{preset.label}</option>
              ))}
            </select>
          </label>
          <div className="support-category-tabs" aria-label="문의 카테고리">
            {SUPPORT_THREAD_CATEGORY_TABS.map((tab) => {
              const isActive = activeCategoryTab === tab.key;
              const tabCount = tab.key === 'all'
                ? filteredThreads.length
                : filteredThreads.filter((item) => item.thread.category === tab.key).length;
              return (
                <button
                  className={`support-category-tab${isActive ? ' active' : ''}`}
                  type="button"
                  key={tab.key}
                  aria-pressed={isActive}
                  onClick={() => setActiveCategoryTab(tab.key)}
                >
                  <span>{tab.label}</span>
                  <strong>{tabCount}</strong>
                </button>
              );
            })}
          </div>
        </div>
        <div className="thread-list">
          {threads.length === 0 ? (
            <article className="thread-card support-empty-card">
              <h3>아직 확인 가능한 문의가 없습니다.</h3>
              <p>비공개 문의는 작성자와 관리자만 볼 수 있습니다.</p>
            </article>
          ) : categoryFilteredThreads.length === 0 ? (
            <article className="thread-card support-empty-card">
              <h3>선택한 조건에 해당하는 문의가 없습니다.</h3>
              <p>전체 또는 다른 카테고리로 전환하면 등록된 문의를 확인할 수 있습니다.</p>
            </article>
          ) : paginatedThreads.map((item) => {
            const canEditThread = canManageThread(item);
            const isEditingThread = editingThreadId === item.thread.id;
            const isExpandedThread = expandedThreadIds.has(item.thread.id);
            const threadEditDraft = threadEditById[item.thread.id] ?? {
              title: item.thread.title,
              body: getCustomerMessage(item)?.body ?? '',
            };
            const isUnreadThread = isSupportThreadUnread(item.thread, readThreadIds);
            const cardClassName = [
              'thread-card',
              item.thread.status === 'answered' ? 'support-thread-answered' : '',
              targetThreadId === item.thread.id ? 'support-thread-target' : '',
            ].filter(Boolean).join(' ');

            return (
              <article
                className={cardClassName}
                id={`support-${item.thread.id}`}
                key={item.thread.id}
              >
                <div className="thread-meta">
                  <span className="badge">{formatSupportStatusLabel(item.thread.status)}</span>
                  {targetThreadId === item.thread.id ? <span className="badge support-target-badge">알림에서 이동</span> : null}
                  <span>작성 {formatDateTime(item.thread.createdAt)}</span>
                  <span>{item.author?.email ?? 'system'}</span>
                </div>
                <h3 className="support-thread-title">
                  <button
                    aria-controls={`support-messages-${item.thread.id}`}
                    aria-expanded={isExpandedThread}
                    className="support-thread-title-button"
                    onClick={() => toggleThreadExpanded(item.thread.id)}
                    type="button"
                  >
                    <span
                      className={
                        item.thread.visibility === 'private'
                          ? 'support-private-thread-title'
                          : 'support-thread-title-text'
                      }
                    >
                      {item.thread.visibility === 'private' ? <PrivateSupportThreadLockIcon /> : null}
                      {isUnreadThread ? <SupportThreadNewBadge /> : null}
                      <span>{formatSupportThreadDisplayTitle(item.thread)}</span>
                    </span>
                  </button>
                  {canEditThread ? (
                    <span className="support-thread-actions" role="group" aria-label="문의글 관리">
                      <IconButton className="action-icon-button edit" label="문의글 수정" onClick={() => startThreadEdit(item)} disabled={isBusy}>
                        <EditActionIcon />
                      </IconButton>
                      <IconButton className="action-icon-button delete" label="문의글 삭제" onClick={() => void deleteThread(item.thread.id)} disabled={isBusy}>
                        <DeleteActionIcon />
                      </IconButton>
                    </span>
                  ) : null}
                </h3>
                {isEditingThread ? (
                  <div className="support-thread-edit-panel">
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
                    <div className="support-thread-edit-actions">
                      <button className="button" type="button" onClick={() => void saveThreadEdit(item.thread.id)} disabled={isBusy}>
                        저장
                      </button>
                      <button className="button secondary" type="button" onClick={cancelThreadEdit} disabled={isBusy}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : null}
                {isExpandedThread ? (
                  <div
                    aria-label="문의 대화"
                    className="support-message-list"
                    id={`support-messages-${item.thread.id}`}
                  >
                    {item.messages.map((threadMessage) => (
                      <p className={threadMessage.isAdminReply ? 'admin-reply support-admin-reply-line' : undefined} key={threadMessage.id}>
                        {threadMessage.isAdminReply ? (
                          <>
                            <SupportReplyReturnIcon className="support-admin-reply-enter-icon" />
                            <span className="support-admin-reply-badge">답변</span>
                            <span className="support-admin-reply-copy">{formatSupportMessageDisplayBody(item.thread, threadMessage.body)}</span>
                          </>
                        ) : (
                          <>
                            <strong>문의 내용</strong>
                            <span>{formatSupportMessageDisplayBody(item.thread, threadMessage.body)}</span>
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {categoryFilteredThreads.length > SUPPORT_THREAD_PAGE_SIZE ? (
          <nav className="support-pagination" aria-label="문의 목록 페이지">
            {SUPPORT_THREAD_PAGE_NUMBERS.filter((pageNumber) => pageNumber <= threadPageCount).map((pageNumber) => (
              <button
                className={`support-pagination-button${safeCurrentThreadPage === pageNumber ? ' active' : ''}`}
                type="button"
                key={pageNumber}
                aria-current={safeCurrentThreadPage === pageNumber ? 'page' : undefined}
                onClick={() => setCurrentThreadPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </nav>
        ) : null}
      </section>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const PAYMENT_ID_IN_DEPOSIT_TITLE_PATTERN = /\s*-\s*pay_[^\s]+/i;
const PAYMENT_ID_DETAIL_LINE_PATTERN = /^결제 ID:\s*.+$/i;

function getSupportThreadDisplayTitle(thread: SupportThreadListItem['thread']): string {
  if (thread.category !== 'deposit') return thread.title;

  return thread.title.replace(PAYMENT_ID_IN_DEPOSIT_TITLE_PATTERN, '').trim() || '입금확인 요청';
}

const formatSupportThreadDisplayTitle = getSupportThreadDisplayTitle;

function getSupportMessageDisplayBody(thread: SupportThreadListItem['thread'], body: string): string {
  if (thread.category !== 'deposit') return body;

  return body
    .split(/\r?\n/)
    .filter((line) => !PAYMENT_ID_DETAIL_LINE_PATTERN.test(line.trim()))
    .join('\n')
    .trim();
}

const formatSupportMessageDisplayBody = getSupportMessageDisplayBody;

function isSupportThreadUnread(
  thread: SupportThreadListItem['thread'],
  readThreadIds: Set<string>,
): boolean {
  return !readThreadIds.has(thread.id);
}

function readSupportThreadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUPPORT_THREAD_READ_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSupportThreadIds(threadIds: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUPPORT_THREAD_READ_STORAGE_KEY, JSON.stringify(Array.from(threadIds)));
}

function SupportThreadNewBadge() {
  return <span className="support-thread-new-badge">New</span>;
}

function SupportReplyReturnIcon({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M15 10l4 4-4 4" />
        <path d="M19 14H9a4 4 0 0 1-4-4V5" />
      </svg>
    </span>
  );
}

function PrivateSupportThreadLockIcon() {
  return (
    <span className="support-private-lock" aria-label="비공개 게시글" title="비공개 게시글">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5.5" y="10.5" width="13" height="9" rx="2.25" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      </svg>
    </span>
  );
}
