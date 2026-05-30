'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthPromptModal } from '../shared/auth-prompt-modal';
import {
  formatSupportCategoryLabel,
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
} from './support-display-labels';
import {
  getPartnershipSupportRequestDraft,
  getTrialSupportRequestDraft,
} from './support-request-defaults';
import {
  SUPPORT_THREAD_FILTER_PRESETS,
  filterSupportThreads,
  getSupportThreadFilterPreset,
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
  const [authSession, setAuthSession] = useState<AuthSessionState | null>(null);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(() => new Set());
  const [threadEditById, setThreadEditById] = useState<Record<string, { title: string; body: string }>>({});
  const presetCategory = searchParams.get('category');
  const targetThreadId = searchParams.get('thread');
  const isTrialPreset = presetCategory === 'trial';
  const isDepositCategory = category === 'deposit';
  const effectiveVisibility = isDepositCategory ? 'private' : visibility;
  const canSubmitTrialRequest = !isTrialPreset || (authSession?.authenticated && authSession.user?.role === 'member');
  const targetThread = targetThreadId
    ? threads.find((item) => item.thread.id === targetThreadId) ?? null
    : null;
  const latestAdminReply = targetThread?.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;
  const orderedThreads = sortSupportThreadsByCreatedAtDesc(threads);
  const activeFilter = getSupportThreadFilterPreset(activeFilterKey);
  const filteredThreads = filterSupportThreads(orderedThreads, activeFilterKey);

  useEffect(() => {
    void refresh();
    void refreshAuthSession();
  }, []);

  useEffect(() => {
    if (presetCategory !== 'trial' && presetCategory !== 'partnership') return;
    const draft = presetCategory === 'partnership'
      ? getPartnershipSupportRequestDraft()
      : getTrialSupportRequestDraft();
    setCategory(presetCategory);
    setTitle(draft.title);
    setBody(draft.body);
    setVisibility('private');
  }, [presetCategory]);

  useEffect(() => {
    if (!targetThreadId) return;

    const target = document.getElementById(`support-${targetThreadId}`);
    target?.scrollIntoView({ block: 'center' });
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      next.add(targetThreadId);
      return next;
    });
  }, [targetThreadId, threads]);

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
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const payload = await response.json();
      setAuthSession({
        authenticated: Boolean(response.ok && payload.authenticated),
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

    if (!canSubmitTrialRequest) {
      const nextMessage = authSession?.authenticated
        ? '무료체험 신청은 일반회원 계정으로 로그인한 상태에서만 접수할 수 있습니다.'
        : '무료체험 신청은 회원가입 후 일반회원으로 로그인해야 접수할 수 있습니다.';
      window.alert(nextMessage);
      setMessage(nextMessage);
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
    setMessage(`문의 ${payload.thread.id}가 등록되었습니다. 답변이 오면 알림으로 알려드릴게요.`);
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
      }
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
        {isTrialPreset && !canSubmitTrialRequest && (
          <div className="trial-auth-gate" role="status">
            <strong>무료체험 신청은 일반회원 로그인이 필요합니다.</strong>
            <p>회원가입을 완료하면 일반회원으로 자동 로그인되고 무료체험 신청 작성 화면으로 돌아옵니다.</p>
            <div className="actions compact">
              <a className="button" href="/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form">
                회원가입 후 신청
              </a>
              <a className="button secondary" href="/login?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form">
                일반회원 로그인
              </a>
            </div>
          </div>
        )}
        <form className="form support-form-grid" onSubmit={submitThread}>
          <label className="support-field" htmlFor="supportCategory">
            <span>분류</span>
            <select id="supportCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="deposit">{formatSupportCategoryLabel('deposit')}</option>
              <option value="cancel">{formatSupportCategoryLabel('cancel')}</option>
              <option value="usage">{formatSupportCategoryLabel('usage')}</option>
              <option value="signal">{formatSupportCategoryLabel('signal')}</option>
              <option value="trial">{formatSupportCategoryLabel('trial')}</option>
              <option value="partnership">{formatSupportCategoryLabel('partnership')}</option>
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
            loginHref={isTrialPreset ? '/login?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form' : '/login?redirect=/support'}
            signupHref={isTrialPreset ? '/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form' : '/signup?redirect=/support'}
            onClose={() => setShowAuthPromptModal(false)}
          />
        ) : null}
      </section>

      <section className="support-panel-frame support-thread-card">
        <div className="toolbar support-thread-toolbar">
          <h2>문의 목록</h2>
          <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>새로고침</button>
        </div>
        {targetThreadId && (
          <div className="support-deep-link-notice" role="status">
            <span className="support-deep-link-kicker">답변 확인 대상 문의</span>
            {targetThread ? (
              <>
                <div className="thread-meta">
                  <span className="badge">{formatSupportStatusLabel(targetThread.thread.status)}</span>
                  <span>{formatSupportCategoryLabel(targetThread.thread.category)}</span>
                  <span>{formatSupportVisibilityLabel(targetThread.thread.visibility)}</span>
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
        <div className="quick-filter-row" aria-label="내 문의 빠른 필터">
          {SUPPORT_THREAD_FILTER_PRESETS.map((preset) => {
            const isActive = activeFilter.key === preset.key;
            const presetCount = filterSupportThreads(orderedThreads, preset.key).length;
            return (
              <button
                className={`button secondary${isActive ? ' active' : ''}`}
                type="button"
                key={preset.key}
                aria-pressed={isActive}
                onClick={() => setActiveFilterKey(preset.key)}
              >
                {preset.label}
                <strong className="quick-filter-count">{presetCount}</strong>
              </button>
            );
          })}
        </div>
        <p className="support-filter-summary">
          현재 필터: {activeFilter.label} / 표시 {filteredThreads.length}건
        </p>
        <div className="thread-list">
          {threads.length === 0 ? (
            <article className="thread-card support-empty-card">
              <h3>아직 확인 가능한 문의가 없습니다.</h3>
              <p>비공개 문의는 작성자와 관리자만 볼 수 있습니다.</p>
            </article>
          ) : filteredThreads.length === 0 ? (
            <article className="thread-card support-empty-card">
              <h3>현재 필터에 해당하는 문의가 없습니다.</h3>
              <p>전체 필터로 전환하면 등록된 문의를 모두 확인할 수 있습니다.</p>
            </article>
          ) : filteredThreads.map((item) => {
            const replyPreview = item.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;
            const canEditThread = canManageThread(item);
            const isEditingThread = editingThreadId === item.thread.id;
            const isExpandedThread = expandedThreadIds.has(item.thread.id);
            const threadEditDraft = threadEditById[item.thread.id] ?? {
              title: item.thread.title,
              body: getCustomerMessage(item)?.body ?? '',
            };
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
                  {replyPreview ? <span className="badge support-answer-badge">답변 확인 가능</span> : null}
                  {targetThreadId === item.thread.id ? <span className="badge support-target-badge">알림에서 이동</span> : null}
                  <span>{formatSupportCategoryLabel(item.thread.category)}</span>
                  <span>{formatSupportVisibilityLabel(item.thread.visibility)}</span>
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
                      <span>{formatSupportThreadDisplayTitle(item.thread)}</span>
                    </span>
                  </button>
                </h3>
                {canEditThread ? (
                  <div className="support-thread-actions">
                    <button className="button secondary compact" type="button" onClick={() => startThreadEdit(item)} disabled={isBusy}>
                      수정
                    </button>
                    <button className="button danger compact" type="button" onClick={() => void deleteThread(item.thread.id)} disabled={isBusy}>
                      삭제
                    </button>
                  </div>
                ) : null}
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
                      <p className={threadMessage.isAdminReply ? 'admin-reply' : undefined} key={threadMessage.id}>
                        {threadMessage.isAdminReply ? '관리자 답변: ' : '문의 내용: '}
                        {formatSupportMessageDisplayBody(item.thread, threadMessage.body)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
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
