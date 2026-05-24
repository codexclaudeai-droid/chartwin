'use client';

import { useEffect, useState } from 'react';
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
  const [threads, setThreads] = useState<SupportThreadListItem[]>([]);
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [message, setMessage] = useState('로그인 후 1:1 문의를 남길 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/support/threads');
    const payload = await response.json();
    setIsBusy(false);
    setThreads(payload.threads || []);
  }

  async function submitThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title, body, visibility }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 등록에 실패했습니다. 먼저 로그인해 주세요.');
      return;
    }
    setTitle('');
    setBody('');
    setMessage(`문의 ${payload.thread.id}가 등록되었습니다.`);
    await refresh();
  }

  async function submitDefaultThread() {
    const draft = getDefaultSupportRequestDraft();
    setIsBusy(true);
    const response = await fetch('/api/support/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title: draft.title, body: draft.body, visibility }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '문의 등록에 실패했습니다. 먼저 로그인해 주세요.');
      return;
    }
    setTitle('');
    setBody('');
    setMessage(`문의 ${payload.thread.id}가 등록되었습니다.`);
    await refresh();
  }

  return (
    <section className="grid-panel">
      <div className="card">
        <h2>1:1 문의 작성</h2>
        <form className="form" onSubmit={submitThread}>
          <label htmlFor="supportCategory">분류</label>
          <select id="supportCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="deposit">입금/결제</option>
            <option value="cancel">취소/환불</option>
            <option value="usage">사용법</option>
            <option value="signal">시그널</option>
            <option value="partnership">제휴</option>
            <option value="general">일반</option>
          </select>
          <label htmlFor="supportVisibility">공개 범위</label>
          <select id="supportVisibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="private">비공개</option>
            <option value="public">공개</option>
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
        <div className="thread-list">
          {threads.map((item) => (
            <article className="thread-card" key={item.thread.id}>
              <div className="thread-meta">
                <span className="badge">{item.thread.status}</span>
                <span>{item.thread.visibility}</span>
                <span>{item.author?.email ?? 'system'}</span>
              </div>
              <h3>{item.thread.title}</h3>
              {item.messages.map((threadMessage) => (
                <p className={threadMessage.isAdminReply ? 'admin-reply' : undefined} key={threadMessage.id}>
                  {threadMessage.isAdminReply ? '관리자: ' : '문의: '}
                  {threadMessage.body}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
