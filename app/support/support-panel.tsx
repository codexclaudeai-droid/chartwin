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
} from '../admin/support-thread-filters';

type AuthSessionState = {
  authenticated: boolean;
  user: {
    role: string;
  } | null;
};

type SupportThreadListItem = {
  thread: {
    id: string;
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
  const presetCategory = searchParams.get('category');
  const targetThreadId = searchParams.get('thread');
  const isTrialPreset = presetCategory === 'trial';
  const canSubmitTrialRequest = !isTrialPreset || (authSession?.authenticated && authSession.user?.role === 'member');
  const targetThread = targetThreadId
    ? threads.find((item) => item.thread.id === targetThreadId) ?? null
    : null;
  const latestAdminReply = targetThread?.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;
  const orderedThreads = [...threads].sort((a, b) => {
    if (a.thread.status === b.thread.status) {
      return new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime();
    }
    if (a.thread.status === 'answered') return -1;
    if (b.thread.status === 'answered') return 1;
    return 0;
  });
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
      body: JSON.stringify({ category, title: input.title, body: input.body, visibility }),
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

  return (
    <section className="grid-panel support-workspace" id="support-inquiry-form">
      <div className="card support-compose-card">
        <h2>1:1 문의 작성</h2>
        <p className="notice compact">문의 유형을 선택하고 필요한 내용을 남겨주세요. 관리자가 확인 후 답변합니다.</p>
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
        <form className="form" onSubmit={submitThread}>
          <label htmlFor="supportCategory">분류</label>
          <select id="supportCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="deposit">{formatSupportCategoryLabel('deposit')}</option>
            <option value="cancel">{formatSupportCategoryLabel('cancel')}</option>
            <option value="usage">{formatSupportCategoryLabel('usage')}</option>
            <option value="signal">{formatSupportCategoryLabel('signal')}</option>
            <option value="trial">{formatSupportCategoryLabel('trial')}</option>
            <option value="partnership">{formatSupportCategoryLabel('partnership')}</option>
            <option value="general">{formatSupportCategoryLabel('general')}</option>
          </select>
          <label htmlFor="supportVisibility">공개 범위</label>
          <select id="supportVisibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="private">{formatSupportVisibilityLabel('private')}</option>
            <option value="public">{formatSupportVisibilityLabel('public')}</option>
          </select>
          <label htmlFor="supportTitle">제목</label>
          <input id="supportTitle" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <label htmlFor="supportBody">내용</label>
          <textarea id="supportBody" value={body} onChange={(event) => setBody(event.target.value)} required />
          <div className="actions compact">
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
      </div>

      <div className="card wide support-thread-card">
        <div className="toolbar">
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
                <strong>{targetThread.thread.title}</strong>
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
        <p className="notice compact">
          현재 필터: {activeFilter.label} / 표시 {filteredThreads.length}건
        </p>
        <div className="thread-list">
          {threads.length === 0 ? (
            <article className="thread-card">
              <h3>아직 확인 가능한 문의가 없습니다.</h3>
              <p>비공개 문의는 작성자와 관리자만 볼 수 있습니다.</p>
            </article>
          ) : filteredThreads.length === 0 ? (
            <article className="thread-card">
              <h3>현재 필터에 해당하는 문의가 없습니다.</h3>
              <p>전체 필터로 전환하면 등록된 문의를 모두 확인할 수 있습니다.</p>
            </article>
          ) : filteredThreads.map((item) => {
            const replyPreview = item.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;
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
                <h3>{item.thread.title}</h3>
                {replyPreview ? (
                  <p className="support-reply-preview">
                    <b>최근 답변</b>: {replyPreview.body}
                  </p>
                ) : null}
                <div aria-label="문의 대화" className="support-message-list">
                  {item.messages.map((threadMessage) => (
                    <p className={threadMessage.isAdminReply ? 'admin-reply' : undefined} key={threadMessage.id}>
                      {threadMessage.isAdminReply ? '관리자 답변: ' : '문의 내용: '}
                      {threadMessage.body}
                    </p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
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
