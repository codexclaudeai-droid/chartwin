import type { Metadata } from 'next';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';

export const metadata: Metadata = {
  title: '이용약관 | TradingCore',
  description: 'TradingCore 실시간 알고리즘 트레이딩 시그널 서비스 이용약관입니다.',
};

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const persistence = getAsyncChartServicePersistence();
  const webInfoSettings = await persistence.runRead((repository) => (
    getAsyncWebInfoSettingsForDisplay(repository)
  ));

  return (
    <main className="page support-page legal-service-page">
      <section className="support-page-hero">
        <span className="eyebrow">Terms</span>
        <h1>이용약관</h1>
        <p className="lede">
          TradingCore의 차트, 시그널, 알림, 구독 서비스를 안전하게 이용하기 위한 기본 약속입니다.
        </p>
      </section>

      <section className="support-public-board legal-policy-summary" aria-label="약관 핵심 안내">
        <div className="section-heading compact">
          <span>Policy Guide</span>
          <h2 className="support-board-section-title">서비스 이용 전 확인해 주세요.</h2>
        </div>
        <div className="support-public-board-grid">
          <article className="support-public-board-card">
            <span>Signal</span>
            <strong>시그널은 참고 지표</strong>
            <p>투자 결과를 보장하지 않으며 최종 판단은 회원 본인에게 있습니다.</p>
          </article>
          <article className="support-public-board-card">
            <span>Subscription</span>
            <strong>구독은 관리자 확인 기반</strong>
            <p>입금 확인, 취소, 환불 요청은 운영 절차에 따라 처리됩니다.</p>
          </article>
          <article className="support-public-board-card">
            <span>Support</span>
            <strong>문의는 고객센터로 접수</strong>
            <p>서비스 이용 중 필요한 확인은 고객센터에서 순차 안내합니다.</p>
          </article>
        </div>
      </section>

      <section className="card wide legal-document" aria-label="이용약관 본문">
        <article className="legal-document-section">
          <span className="legal-section-index">01</span>
          <div>
            <h2>관리자 설정 이용약관</h2>
            {renderPolicyContent(webInfoSettings.termsContent)}
          </div>
        </article>
      </section>
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
