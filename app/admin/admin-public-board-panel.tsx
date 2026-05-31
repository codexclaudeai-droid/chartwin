'use client';

import { useEffect, useState } from 'react';
import type { PublicBoardPostRecord } from '../../src/server/chart-service/repository.ts';
import { AdminRefreshButton } from './admin-refresh-button';
import { dispatchAdminRefreshEvent } from './admin-refresh-events';

type PublicBoardPostEditor = Pick<
  PublicBoardPostRecord,
  'body' | 'category' | 'id' | 'isPublished' | 'sortOrder' | 'title'
>;

const PUBLIC_BOARD_CATEGORY_LABELS = {
  notice: '공지사항',
  qna: '질문답변',
  faq: 'FAQ',
} satisfies Record<PublicBoardPostRecord['category'], string>;

const emptyPosts: PublicBoardPostEditor[] = [
  { id: 'public_board_notice', category: 'notice', title: '', body: '', isPublished: true, sortOrder: 10 },
  { id: 'public_board_qna', category: 'qna', title: '', body: '', isPublished: true, sortOrder: 20 },
  { id: 'public_board_faq', category: 'faq', title: '', body: '', isPublished: true, sortOrder: 30 },
];

export function AdminPublicBoardPanel() {
  const [posts, setPosts] = useState<PublicBoardPostEditor[]>(emptyPosts);
  const [message, setMessage] = useState('공개 게시판을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/public-board');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '공개 게시판을 불러오지 못했습니다.');
      return;
    }
    setPosts(normalizePublicBoardPosts(payload.posts));
    setMessage('고객센터 공개 게시판의 공지사항, 질문답변, FAQ 내용을 관리합니다.');
  }

  async function savePosts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/public-board', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '공개 게시판 저장에 실패했습니다.');
      return;
    }
    setPosts(normalizePublicBoardPosts(payload.posts));
    setMessage('공개 게시판을 저장했습니다. 고객센터 화면에 바로 반영됩니다.');
    dispatchAdminRefreshEvent({ source: 'webInfo' });
  }

  function updatePost(id: string, patch: Partial<PublicBoardPostEditor>) {
    setPosts((current) => current.map((post) => (
      post.id === id ? { ...post, ...patch } : post
    )));
  }

  return (
    <section className="card wide" id="admin-public-board">
      <div className="toolbar">
        <div>
          <h2>공개 게시판</h2>
          <p className="notice compact">고객센터 상단에 표시되는 공지사항, 질문답변, FAQ 카드 내용을 수정합니다.</p>
        </div>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
      </div>
      <form className="form admin-web-info-form" onSubmit={savePosts}>
        <div className="plan-services-grid">
          {posts.map((post) => (
            <article className="support-public-board-card" key={post.id}>
              <label htmlFor={`${post.id}-title`}>
                {PUBLIC_BOARD_CATEGORY_LABELS[post.category]} 제목
                <input
                  id={`${post.id}-title`}
                  value={post.title}
                  onChange={(event) => updatePost(post.id, { title: event.target.value })}
                  required
                />
              </label>
              <label htmlFor={`${post.id}-body`}>
                {PUBLIC_BOARD_CATEGORY_LABELS[post.category]} 내용
                <textarea
                  id={`${post.id}-body`}
                  rows={7}
                  value={post.body}
                  onChange={(event) => updatePost(post.id, { body: event.target.value })}
                  required
                />
              </label>
              <label htmlFor={`${post.id}-sort-order`}>
                표시 순서
                <input
                  id={`${post.id}-sort-order`}
                  type="number"
                  value={post.sortOrder}
                  onChange={(event) => updatePost(post.id, { sortOrder: Number(event.target.value) })}
                />
              </label>
              <label className="inline-check" htmlFor={`${post.id}-published`}>
                <input
                  checked={post.isPublished}
                  id={`${post.id}-published`}
                  type="checkbox"
                  onChange={(event) => updatePost(post.id, { isPublished: event.target.checked })}
                />
                고객센터에 공개
              </label>
            </article>
          ))}
        </div>
        <button className="button" type="submit" disabled={isBusy}>
          공개 게시판 저장
        </button>
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

function normalizePublicBoardPosts(posts: unknown): PublicBoardPostEditor[] {
  if (!Array.isArray(posts)) return emptyPosts;
  const normalized = posts.map((post) => ({
    id: typeof post.id === 'string' ? post.id : '',
    category: post.category,
    title: typeof post.title === 'string' ? post.title : '',
    body: typeof post.body === 'string' ? post.body : '',
    isPublished: Boolean(post.isPublished),
    sortOrder: Number.isFinite(Number(post.sortOrder)) ? Number(post.sortOrder) : 0,
  })).filter((post): post is PublicBoardPostEditor => (
    typeof post.id === 'string' &&
    post.id.length > 0 &&
    post.category in PUBLIC_BOARD_CATEGORY_LABELS
  ));

  return normalized.length > 0 ? normalized : emptyPosts;
}
