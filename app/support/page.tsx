import { Suspense } from 'react';
import {
  getAsyncChartServicePersistence,
  listAsyncPublishedPublicBoardPosts,
  PUBLIC_BOARD_CATEGORY_LABELS,
  type PublicBoardCategory,
} from '../../src/server/chart-service/index.ts';
import { SupportPanel } from './support-panel';

export const dynamic = 'force-dynamic';

const SUPPORT_CONTACT_ROUTES = [
  {
    title: '1:1 문의',
    description: '서비스 이용, 구독 상태, 차트 기능, 알림 설정과 관련된 문의를 회원 전용 게시글로 남길 수 있습니다.',
    href: '#support-inquiry-form',
    action: '1:1 문의하기',
  },
  {
    title: '제휴문의',
    description: '영업 제휴, 파트너십, 공동 프로모션 제안은 제휴 문의로 별도 접수합니다.',
    href: '/support?category=partnership#support-inquiry-form',
    action: '제휴 문의하기',
  },
  {
    title: '무료체험신청',
    description: '일반회원 가입 후 BASIC 플랜의 핵심 시그널과 기본 분석 도구를 먼저 체험할 수 있습니다.',
    href: '/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form',
    action: '회원가입 후 무료체험 신청',
  },
];

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
        <p className="lede">1:1 문의, 제휴문의, 무료체험 신청을 목적별로 나누어 빠르게 접수할 수 있습니다.</p>
      </section>

      <section className="support-contact-routes" aria-label="문의 유형 선택">
        {SUPPORT_CONTACT_ROUTES.map((item) => (
          <article className="support-contact-route-card" key={item.title}>
            <span>{item.title}</span>
            <p>{item.description}</p>
            <a className="button secondary" href={item.href}>{item.action}</a>
          </article>
        ))}
      </section>

      <section className="support-public-board" aria-label="공개 게시판">
        <div className="section-heading compact">
          <span>공개 게시판</span>
          <h2>공지사항, 질문답변, FAQ</h2>
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
                  <p>등록된 공개 게시글이 없습니다.</p>
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
