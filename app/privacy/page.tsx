import type { Metadata } from 'next';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';
import LandingScrollTopButton from '../landing-scroll-top-button.tsx';

export const metadata: Metadata = {
  title: '개인정보보호정책 | TradingCore',
  description: 'TradingCore 회원가입, 구독, 고객센터 운영을 위한 개인정보 처리 기준입니다.',
};

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const persistence = getAsyncChartServicePersistence();
  const webInfoSettings = await persistence.runRead((repository) => (
    getAsyncWebInfoSettingsForDisplay(repository)
  ));

  return (
    <main className="page support-page legal-service-page">
      <section className="support-page-hero">
        <span className="eyebrow">Privacy</span>
        <h1>개인정보보호정책</h1>
        <p className="lede">
          TradingCore는 회원의 계정, 구독, 알림, 고객센터 이용에 필요한 개인정보를 목적 범위 안에서 안전하게 처리합니다.
        </p>
      </section>

      <section className="support-public-board legal-policy-summary" aria-label="개인정보 처리 핵심 안내">
        <div className="section-heading compact">
          <span>Privacy Guide</span>
          <h2 className="support-board-section-title">개인정보 처리 기준을 확인해 주세요.</h2>
        </div>
        <div className="support-public-board-grid">
          <article className="support-public-board-card">
            <span>Minimum</span>
            <strong>필요한 정보만 처리</strong>
            <p>회원 운영, 구독 권한, 고객 응대에 필요한 범위로 제한합니다.</p>
          </article>
          <article className="support-public-board-card">
            <span>Security</span>
            <strong>계정 보호 우선</strong>
            <p>인증, 세션, 접근 기록을 통해 비정상 이용을 방지합니다.</p>
          </article>
          <article className="support-public-board-card">
            <span>Control</span>
            <strong>권리 요청 가능</strong>
            <p>열람, 정정, 삭제 등 개인정보 문의는 고객센터로 접수합니다.</p>
          </article>
        </div>
      </section>

      <section className="card wide legal-document" aria-label="개인정보보호정책 본문">
        <article className="legal-document-section">
          <span className="legal-section-index">01</span>
          <div>
            <h2>관리자 설정 개인정보보호정책</h2>
            {renderPolicyContent(webInfoSettings.privacyContent)}
          </div>
        </article>
      </section>

      <LandingScrollTopButton />
    </main>
  );
}

function renderPolicyContent(content: string) {
  if (containsHtmlMarkup(content)) {
    return (
      <div
        className="legal-policy-content html"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <pre className="legal-policy-content">{content}</pre>;
}

function containsHtmlMarkup(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}
