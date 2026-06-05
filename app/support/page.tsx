import { Suspense } from 'react';
import {
  getAsyncChartServicePersistence,
  listAsyncPublishedPublicBoardPosts,
  PUBLIC_BOARD_CATEGORY_LABELS,
  type PublicBoardCategory,
} from '../../src/server/chart-service/index.ts';
import { SupportPanel } from './support-panel';

export const dynamic = 'force-dynamic';

const PUBLIC_BOARD_CATEGORIES = ['notice', 'qna', 'faq'] as const satisfies PublicBoardCategory[];

export default async function SupportPage() {
  const persistence = getAsyncChartServicePersistence();
  const publicBoardPosts = await persistence.runRead(async (repository) => (
    await listAsyncPublishedPublicBoardPosts(repository)
  ));

  return (
    <main className="page support-page">
      <section className="support-page-hero">
        <span className="eyebrow">Support Center</span>
        <h1>고객센터</h1>
        <p className="lede">입금 확인, 환불 요청, 사용 방법 문의를 한 곳에서 관리합니다. 필요한 내용을 남기면 관리자 확인 후 답변합니다.</p>
      </section>

      <section className="support-public-board" aria-label="공개 게시판">
        <div className="section-heading compact">
          <span>공개 게시판</span>
          <h2 className="support-board-section-title">공지사항, 질문답변, FAQ</h2>
        </div>
        <div className="support-public-board-grid">
          {PUBLIC_BOARD_CATEGORIES.map((category) => {
            const posts = publicBoardPosts.filter((post) => post.category === category);
            return (
              <article className="support-public-board-card" key={category}>
                <span>{PUBLIC_BOARD_CATEGORY_LABELS[category]}</span>
                {posts.length > 0 ? posts.map((post) => (
                  <div className="support-public-board-post" key={post.id}>
                    <strong>{post.title}</strong>
                    <p>{post.body}</p>
                  </div>
                )) : (
                  <p className="support-board-empty">등록된 공개 게시글이 없습니다.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <Suspense fallback={<section className="card wide">문의 목록을 불러오는 중입니다.</section>}>
        <SupportPanel />
      </Suspense>
    </main>
  );
}
