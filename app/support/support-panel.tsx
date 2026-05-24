'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatSupportCategoryLabel,
  formatSupportStatusLabel,
  formatSupportVisibilityLabel,
} from './support-display-labels';
import { getDefaultSupportRequestDraft } from './support-request-defaults';

type SupportThreadListItem = {
  thread: {
    id: string;
    category: string;
    title: string;
    visibility: string;
    status: string;
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
  const [message, setMessage] = useState('로그인하면 1:1 문의를 남길 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const targetThreadId = searchParams.get('thread');
  const targetThread = targetThreadId
    ? threads.find((item) => item.thread.id === targetThreadId) ?? null
    : null;
  const latestAdminReply = targetThread?.messages.filter((threadMessage) => threadMessage.isAdminReply).at(-1) ?? null;

  useEffect(() => {
    void refresh();
  }, []);

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

  async function submitThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createThread({ title, body });
  }

  async function submitDefaultThread() {
    const draft = getDefaultSupportRequestDraft();
    await createThread({ title: draft.title, body: draft.body });
  }

  async function createThread(input: { title: string; body: string }) {
    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title: input.title, body: input.body, visibility }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 등록에 실패했습니다. 먼저 로그인해 주세요.');
      return;
    }
    setTitle('');
    setBody('');
    setMessage(`문의 ${payload.thread.id}가 등록되었습니다. 답변이 오면 알림으로 알려드릴게요.`);
    await refresh();
  }

  return (
    <section className="grid-panel">
      <div className="card">
        <h2>1:1 문의 작성</h2>
        <p className="notice compact">입금 확인, 환불 요청, 시그널 사용 문의를 남기면 관리자가 확인 후 답변합니다.</p>
        <form className="form" onSubmit={submitThread}>
          <label htmlFor="supportCategory">분류</label>
          <select id="supportCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="deposit">{formatSupportCategoryLabel('deposit')}</option>
            <option value="cancel">{formatSupportCategoryLabel('cancel')}</option>
            <option value="usage">{formatSupportCategoryLabel('usage')}</option>
            <option value="signal">{formatSupportCategoryLabel('signal')}</option>
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
          <button className="button" type="submit" disabled={isBusy}>
            {isBusy ? '처리 중' : '문의 등록'}
          </button>
          <button className="button secondary" type="button" onClick={submitDefaultThread} disabled={isBusy}>
            빠른 문의 등록
          </button>
        </form>
        <p className="notice">{message}</p>
      </div>
      <div className="card wide">
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
        <div className="thread-list">
          {threads.length === 0 ? (
            <article className="thread-card">
              <h3>아직 확인 가능한 문의가 없습니다.</h3>
              <p>비공개 문의는 작성자와 관리자만 볼 수 있습니다.</p>
            </article>
          ) : threads.map((item) => (
            <article
              className={`thread-card${targetThreadId === item.thread.id ? ' support-thread-target' : ''}`}
              id={`support-${item.thread.id}`}
              key={item.thread.id}
            >
              <div className="thread-meta">
                <span className="badge">{formatSupportStatusLabel(item.thread.status)}</span>
                <span>{formatSupportCategoryLabel(item.thread.category)}</span>
                <span>{formatSupportVisibilityLabel(item.thread.visibility)}</span>
                <span>{item.author?.email ?? 'system'}</span>
              </div>
              <h3>{item.thread.title}</h3>
              <div aria-label="문의 대화" className="support-message-list">
                {item.messages.map((threadMessage) => (
                  <p className={threadMessage.isAdminReply ? 'admin-reply' : undefined} key={threadMessage.id}>
                    {threadMessage.isAdminReply ? '관리자 답변: ' : '문의 내용: '}
                    {threadMessage.body}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
