import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';

export const metadata: Metadata = {
  title: '이용약관 | TradingCore',
  description: 'TradingCore 서비스 이용약관을 확인하세요.',
};

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const persistence = getAsyncChartServicePersistence();
  const webInfoSettings = await persistence.runRead((repository) => (
    getAsyncWebInfoSettingsForDisplay(repository)
  ));

  return (
    <main className="page legal-page">
      <section className="legal-page-hero">
        <span className="eyebrow">Terms</span>
        <h1>이용약관</h1>
        <p className="lede">
          TradingCore 서비스 이용, 구독, 차트 열람, 고객센터 운영 기준을 안내합니다.
        </p>
      </section>

      <section className="legal-document" aria-label="이용약관 본문">
        {renderPolicyContent(webInfoSettings.termsContent)}
      </section>

      <nav className="legal-page-links" aria-label="관련 링크">
        <Link className="text-link compact" href="/privacy">개인정보보호정책</Link>
        <Link className="text-link compact" href="/support">고객센터</Link>
      </nav>
    </main>
  );
}

function renderPolicyContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => (
      <p key={paragraph}>{paragraph}</p>
    ));
}
